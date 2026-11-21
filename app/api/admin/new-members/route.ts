import { NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { DAY_MS } from '@/lib/quant-rules';

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const db = getDb();
  const now = Date.now();
  const cutoff = now - 3 * DAY_MS;

  // Separate Active Deposited New Members (first 3 days from first_deposit_at) vs Unfunded New Signups
  const activeNewMembers = db
    .prepare(
      `SELECT u.id, u.uid, u.username, u.full_name, u.email, u.capital_balance, u.profit_balance,
              u.total_deposited, u.first_deposit_at, u.created_at,
              sp.uid as sponsor_uid, sp.username as sponsor_username
       FROM users u
       LEFT JOIN users sp ON sp.id = u.referred_by_id
       WHERE u.first_deposit_at IS NOT NULL AND u.first_deposit_at >= ?
       ORDER BY u.first_deposit_at DESC`
    )
    .all(cutoff);

  const unfundedNewMembers = db
    .prepare(
      `SELECT u.id, u.uid, u.username, u.full_name, u.email, u.created_at,
              sp.uid as sponsor_uid, sp.username as sponsor_username
       FROM users u
       LEFT JOIN users sp ON sp.id = u.referred_by_id
       WHERE u.first_deposit_at IS NULL AND u.created_at >= ?
       ORDER BY u.created_at DESC`
    )
    .all(cutoff);

  const res = NextResponse.json({ activeNewMembers, unfundedNewMembers });
  return attachRefreshedAdminCookie(res, guard.admin);
}
