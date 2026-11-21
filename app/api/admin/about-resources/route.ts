import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb } from '@/lib/db';

const createResourceSchema = z.object({
  title: z.string().trim().min(2).max(100),
  resourceType: z.enum(['PDF', 'POSTER']),
  description: z.string().trim().max(240).optional(),
  fileName: z.string().trim().min(1).max(120),
  fileDataUrl: z
    .string()
    .min(20)
    .max(4_500_000, 'File exceeds 3 MB upload cap.'),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const resources = getDb()
    .prepare('SELECT * FROM about_resources ORDER BY created_at DESC')
    .all();

  const res = NextResponse.json({ resources });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = createResourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid resource upload.' },
        { status: 400 }
      );
    }

    const isPdf = parsed.data.fileDataUrl.startsWith('data:application/pdf');
    const isImage = parsed.data.fileDataUrl.startsWith('data:image/');
    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Only PDF documents or PNG/JPG/WebP poster images are allowed.' },
        { status: 400 }
      );
    }

    const info = getDb()
      .prepare(
        `INSERT INTO about_resources
         (title, resource_type, description, file_data_url, file_name, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        parsed.data.title,
        parsed.data.resourceType,
        parsed.data.description || '',
        parsed.data.fileDataUrl,
        parsed.data.fileName,
        guard.admin.displayName,
        Date.now()
      );

    logAdminAudit({
      admin: guard.admin,
      action: 'UPLOAD_ABOUT_RESOURCE',
      targetType: 'ABOUT_RESOURCE',
      targetId: Number(info.lastInsertRowid),
      details: { title: parsed.data.title, type: parsed.data.resourceType },
      ipAddress: await getClientIp(),
    });

    const res = NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) }, { status: 201 });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    console.error('Upload resource error:', err);
    return NextResponse.json({ error: 'Unable to upload resource.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid resource ID.' }, { status: 400 });
  }

  getDb().prepare('DELETE FROM about_resources WHERE id = ?').run(id);

  logAdminAudit({
    admin: guard.admin,
    action: 'DELETE_ABOUT_RESOURCE',
    targetType: 'ABOUT_RESOURCE',
    targetId: id,
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}
