import { NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const db = getDb();
  const history = db
    .prepare(
      `SELECT w.*, u.uid, u.username, u.full_name, u.total_deposited, u.total_withdrawn
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       ORDER BY w.created_at DESC`
    )
    .all();

  const perUserSummary = db
    .prepare(
      `SELECT u.id as user_id, u.uid, u.username, u.full_name,
              COUNT(CASE WHEN w.status = 'PAID' THEN 1 END) as paid_count,
              COALESCE(SUM(CASE WHEN w.status = 'PAID' THEN w.gross_amount ELSE 0 END), 0) as total_gross_paid,
              COALESCE(SUM(CASE WHEN w.status = 'PAID' THEN w.net_amount ELSE 0 END), 0) as total_net_paid,
              MAX(CASE WHEN w.status = 'PAID' THEN w.reviewed_at END) as last_paid_at
       FROM users u
       JOIN withdrawals w ON w.user_id = u.id
       GROUP BY u.id
       ORDER BY total_gross_paid DESC`
    )
    .all();

  const res = NextResponse.json({ history, perUserSummary });
  return attachRefreshedAdminCookie(res, guard.admin);
}
