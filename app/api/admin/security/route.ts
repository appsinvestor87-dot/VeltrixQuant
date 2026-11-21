import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb } from '@/lib/db';

const postSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('UNBLOCK_IP'), ip: z.string().min(3).max(64) }),
  z.object({ action: z.literal('REVIEW_CHAT_FLAG'), logId: z.number().int().positive() }),
]);

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const db = getDb();
  const auditLogs = db
    .prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 120')
    .all();

  const ipLocks = db
    .prepare('SELECT * FROM ip_locks ORDER BY last_attempt_at DESC')
    .all();

  const chatFlags = db
    .prepare(
      `SELECT c.*, u.uid
       FROM chatbot_logs c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.is_red_flag = 1
       ORDER BY c.reviewed ASC, c.created_at DESC LIMIT 80`
    )
    .all();

  const recentChats = db
    .prepare(
      `SELECT c.*, u.uid
       FROM chatbot_logs c
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC LIMIT 40`
    )
    .all();

  const res = NextResponse.json({ auditLogs, ipLocks, chatFlags, recentChats });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid security action.' }, { status: 400 });
  }

  const db = getDb();
  const ip = await getClientIp();

  if (parsed.data.action === 'UNBLOCK_IP') {
    db.prepare('DELETE FROM ip_locks WHERE ip = ?').run(parsed.data.ip);
    logAdminAudit({
      admin: guard.admin,
      action: 'UNBLOCK_IP',
      targetType: 'IP_LOCK',
      targetId: parsed.data.ip,
      ipAddress: ip,
    });
  } else {
    db.prepare('UPDATE chatbot_logs SET reviewed = 1 WHERE id = ?').run(parsed.data.logId);
    logAdminAudit({
      admin: guard.admin,
      action: 'REVIEW_CHAT_RED_FLAG',
      targetType: 'CHATBOT_LOG',
      targetId: parsed.data.logId,
      ipAddress: ip,
    });
  }

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}
