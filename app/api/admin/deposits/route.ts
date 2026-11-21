import { NextRequest, NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const status = req.nextUrl.searchParams.get('status') || 'ALL';
  const db = getDb();

  const whereClause =
    status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
      ? 'WHERE d.status = ?'
      : '';

  const sql = `
    SELECT d.*, u.uid, u.username, u.full_name, u.email, u.bep20_address as user_bep20,
           pa.label as account_label, pa.address as treasury_address
    FROM deposits d
    JOIN users u ON u.id = d.user_id
    LEFT JOIN payment_accounts pa ON pa.id = d.payment_account_id
    ${whereClause}
    ORDER BY d.created_at DESC
  `;

  const deposits = whereClause ? db.prepare(sql).all(status) : db.prepare(sql).all();
  const res = NextResponse.json({ deposits });
  return attachRefreshedAdminCookie(res, guard.admin);
}
