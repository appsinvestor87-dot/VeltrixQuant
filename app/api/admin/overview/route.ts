import { NextResponse } from 'next/server';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getDb } from '@/lib/db';
import { DAY_MS, roundUsdt } from '@/lib/quant-rules';
import { getStartOfTodayUtcMs, settleDueSignals } from '@/lib/settlement';

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  settleDueSignals();
  const db = getDb();
  const now = Date.now();
  const todayStart = getStartOfTodayUtcMs(now);
  const threeDaysAgo = now - 3 * DAY_MS;

  const userStats = db
    .prepare(
      `SELECT COUNT(*) as totalUsers,
              SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as activeUsers,
              SUM(CASE WHEN status != 'ACTIVE' THEN 1 ELSE 0 END) as blockedUsers,
              SUM(CASE WHEN first_deposit_at IS NOT NULL AND first_deposit_at >= ? THEN 1 ELSE 0 END) as newDepositedUsers,
              COALESCE(SUM(capital_balance), 0) as totalCapital,
              COALESCE(SUM(profit_balance), 0) as totalProfitBalance
       FROM users`
    )
    .get(threeDaysAgo) as {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    newDepositedUsers: number;
    totalCapital: number;
    totalProfitBalance: number;
  };

  const depStats = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as totalApproved,
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
              COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pendingAmount
       FROM deposits`
    )
    .get() as { totalApproved: number; pendingCount: number; pendingAmount: number };

  const wdStats = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'PAID' THEN gross_amount ELSE 0 END), 0) as totalPaidGross,
              COALESCE(SUM(CASE WHEN status = 'PAID' THEN net_amount ELSE 0 END), 0) as totalPaidNet,
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
              COALESCE(SUM(CASE WHEN status = 'PENDING' THEN net_amount ELSE 0 END), 0) as pendingNet
       FROM withdrawals`
    )
    .get() as { totalPaidGross: number; totalPaidNet: number; pendingCount: number; pendingNet: number };

  const foodStats = db
    .prepare(
      `SELECT SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
              COALESCE(SUM(CASE WHEN status = 'PENDING' THEN allowance_amount ELSE 0 END), 0) as pendingAmount
       FROM food_allowances`
    )
    .get() as { pendingCount: number; pendingAmount: number };

  const signalToday = db
    .prepare(
      `SELECT COUNT(*) as claimsToday,
              COALESCE(SUM(expected_profit), 0) as profitToday
       FROM signal_claims WHERE claimed_at >= ?`
    )
    .get(todayStart) as { claimsToday: number; profitToday: number };

  const redFlags = db
    .prepare('SELECT COUNT(*) as unreviewedFlags FROM chatbot_logs WHERE is_red_flag = 1 AND reviewed = 0')
    .get() as { unreviewedFlags: number };

  const donationStats = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as totalApproved,
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount
       FROM donations`
    )
    .get() as { totalApproved: number; pendingCount: number };

  const res = NextResponse.json({
    admin: {
      displayName: guard.admin.displayName,
      role: guard.admin.role,
    },
    overview: {
      totalUsers: userStats.totalUsers || 0,
      activeUsers: userStats.activeUsers || 0,
      blockedUsers: userStats.blockedUsers || 0,
      newDepositedUsers: userStats.newDepositedUsers || 0,
      totalCapital: roundUsdt(userStats.totalCapital || 0),
      totalProfitBalance: roundUsdt(userStats.totalProfitBalance || 0),
      totalApprovedDeposits: roundUsdt(depStats.totalApproved || 0),
      pendingDepositsCount: depStats.pendingCount || 0,
      pendingDepositsAmount: roundUsdt(depStats.pendingAmount || 0),
      totalPaidWithdrawals: roundUsdt(wdStats.totalPaidNet || 0),
      pendingWithdrawalsCount: wdStats.pendingCount || 0,
      pendingWithdrawalsNet: roundUsdt(wdStats.pendingNet || 0),
      pendingFoodAllowancesCount: foodStats.pendingCount || 0,
      pendingFoodAllowancesAmount: roundUsdt(foodStats.pendingAmount || 0),
      signalClaimsToday: signalToday.claimsToday || 0,
      signalProfitToday: roundUsdt(signalToday.profitToday || 0),
      unreviewedRedFlags: redFlags.unreviewedFlags || 0,
      netTreasuryFlow: roundUsdt((depStats.totalApproved || 0) - (wdStats.totalPaidNet || 0)),
      totalApprovedDonations: roundUsdt(donationStats.totalApproved || 0),
      pendingDonationsCount: donationStats.pendingCount || 0,
    },
  });
  return attachRefreshedAdminCookie(res, guard.admin);
}
