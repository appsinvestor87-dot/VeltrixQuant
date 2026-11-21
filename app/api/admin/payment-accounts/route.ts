import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { ensurePaymentAccountQr, getDb } from '@/lib/db';
import { validateBep20Address } from '@/lib/quant-rules';

const createSchema = z.object({
  label: z.string().trim().min(2).max(60),
  address: z.string().trim(),
  customQrDataUrl: z.string().max(400_000).optional(),
});

const patchSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const accounts = getDb()
    .prepare('SELECT * FROM payment_accounts ORDER BY id DESC')
    .all() as Array<{
    id: number;
    label: string;
    network: string;
    address: string;
    qr_data_url: string | null;
    is_active: number;
    created_at: number;
  }>;

  for (const acc of accounts) {
    if (!acc.qr_data_url) {
      acc.qr_data_url = await ensurePaymentAccountQr(acc.id, acc.address);
    }
  }

  const res = NextResponse.json({ accounts });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  // Only Master Admin may add/change company receiving wallets
  if (guard.admin.role !== 'MASTER_ADMIN') {
    return NextResponse.json(
      { error: 'Only Master Admin can modify company deposit wallets.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid payment account.' },
        { status: 400 }
      );
    }

    if (!validateBep20Address(parsed.data.address)) {
      return NextResponse.json(
        { error: 'Invalid BEP20 address (must start with 0x followed by 40 hex chars).' },
        { status: 400 }
      );
    }

    const qrDataUrl =
      parsed.data.customQrDataUrl && parsed.data.customQrDataUrl.startsWith('data:image/')
        ? parsed.data.customQrDataUrl
        : await QRCode.toDataURL(parsed.data.address.trim(), {
            width: 240,
            margin: 2,
            color: { dark: '#0B1117', light: '#FFFFFF' },
          });

    const info = getDb()
      .prepare(
        `INSERT INTO payment_accounts (label, network, address, qr_data_url, is_active, created_at)
         VALUES (?, 'USDT-BEP20', ?, ?, 1, ?)`
      )
      .run(parsed.data.label, parsed.data.address.trim(), qrDataUrl, Date.now());

    logAdminAudit({
      admin: guard.admin,
      action: 'ADD_PAYMENT_ACCOUNT',
      targetType: 'PAYMENT_ACCOUNT',
      targetId: Number(info.lastInsertRowid),
      details: { label: parsed.data.label, address: parsed.data.address.trim() },
      ipAddress: await getClientIp(),
    });

    const res = NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) }, { status: 201 });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    console.error('Payment account create error:', err);
    return NextResponse.json({ error: 'Unable to save payment account.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  if (guard.admin.role !== 'MASTER_ADMIN') {
    return NextResponse.json(
      { error: 'Only Master Admin can toggle company deposit wallets.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  getDb()
    .prepare('UPDATE payment_accounts SET is_active = ? WHERE id = ?')
    .run(parsed.data.isActive ? 1 : 0, parsed.data.id);

  logAdminAudit({
    admin: guard.admin,
    action: 'TOGGLE_PAYMENT_ACCOUNT',
    targetType: 'PAYMENT_ACCOUNT',
    targetId: parsed.data.id,
    details: { isActive: parsed.data.isActive },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}
