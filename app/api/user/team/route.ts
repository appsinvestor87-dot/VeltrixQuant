import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDb, getSalaryLevels, getSettingsMap } from '@/lib/db';
import { evaluateSalaryQualification, roundUsdt } from '@/lib/quant-rules';
import { getTeamTreeForUser } from '@/lib/settlement';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const settings = getSettingsMap();
  const isDepositActive = user.capital_balance >= 100 && user.first_deposit_at !== null;
  const tree = getTeamTreeForUser(user.id);
  const salaryLevels = getSalaryLevels();
  const salaryStatus = evaluateSalaryQualification(user.capital_balance, tree.stats, salaryLevels);

  const commissionRow = db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM ledger_transactions
       WHERE user_id = ? AND type = 'REFERRAL_BONUS'`
    )
    .get(user.id) as { total: number };

  const salaryHistory = db
    .prepare(
      `SELECT id, week_key, level_achieved, base_amount, calc_mode, rate_value, payout_amount, paid_at
       FROM salary_payouts
       WHERE user_id = ?
       ORDER BY paid_at DESC
       LIMIT 12`
    )
    .all(user.id);

  return NextResponse.json({
    isDepositActive,
    referralCode: isDepositActive ? user.referral_code : null,
    directReferralBonusPct: Number(settings.direct_referral_bonus_pct || '7'),
    stats: tree.stats,
    inactiveCount: tree.inactiveCount,
    totalReferralCommissionEarned: roundUsdt(commissionRow.total),
    members: tree.members,
    salaryLevels,
    salaryStatus: {
      qualifiedLevel: salaryStatus.qualifiedLevel,
      estimatedSundayPayout: salaryStatus.payoutAmount,
      baseAmount: salaryStatus.baseAmount,
    },
    salaryHistory,
  });
}
