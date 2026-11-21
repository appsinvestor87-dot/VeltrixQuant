import { NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { roundUsdt } from '@/lib/quant-rules';
import { getStartOfTodayUtcMs, settleDueSignals } from '@/lib/settlement';

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  settleDueSignals();
  const db = getDb();
  const now = Date.now();
  const todayStart = getStartOfTodayUtcMs(now);

  const users = db
    .prepare(
      `SELECT u.id, u.uid, u.username, u.full_name, u.email, u.referral_code, u.referred_by_id,
              sp.uid as sponsor_uid, sp.username as sponsor_username,
              u.bep20_address, u.bep20_locked,
              u.capital_balance, u.profit_balance, u.locked_profit_balance,
              u.total_deposited, u.total_withdrawn, u.total_earned,
              u.first_deposit_at, u.status, u.block_reason, u.last_login_ip, u.created_at,
              COALESCE((
                SELECT SUM(sc.expected_profit)
                FROM signal_claims sc
                WHERE sc.user_id = u.id AND sc.status = 'SETTLED' AND sc.settled_at >= ?
              ), 0) as today_profit,
              (SELECT COUNT(*) FROM signal_claims sc WHERE sc.user_id = u.id) as lifetime_signals,
              CASE
                WHEN u.first_deposit_at IS NULL THEN 0
                ELSE MAX(0, (
                  (SELECT COUNT(*) FROM signals s WHERE s.signal_type = 'REGULAR' AND s.starts_at >= u.first_deposit_at AND s.expires_at < ?)
                  -
                  (SELECT COUNT(*) FROM signal_claims sc JOIN signals s ON s.id = sc.signal_id WHERE sc.user_id = u.id AND s.signal_type = 'REGULAR' AND s.expires_at < ?)
                ))
              END as missed_signals,
              (SELECT COUNT(*) FROM users ch WHERE ch.referred_by_id = u.id AND ch.capital_balance >= 100) as active_direct_count
       FROM users u
       LEFT JOIN users sp ON sp.id = u.referred_by_id
       ORDER BY u.id DESC`
    )
    .all(todayStart, now, now) as Array<Record<string, unknown>>;

  const formatted = users.map((u) => ({
    ...u,
    capital_balance: roundUsdt(Number(u.capital_balance || 0)),
    profit_balance: roundUsdt(Number(u.profit_balance || 0)),
    locked_profit_balance: roundUsdt(Number(u.locked_profit_balance || 0)),
    today_profit: roundUsdt(Number(u.today_profit || 0)),
  }));

  const res = NextResponse.json({ users: formatted });
  return attachRefreshedAdminCookie(res, guard.admin);
}
