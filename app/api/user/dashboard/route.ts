import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDb, getSettingsMap, normalizeTelegramUrl } from '@/lib/db';
import { getWithdrawLockStatus, roundUsdt } from '@/lib/quant-rules';
import { getStartOfTodayUtcMs, settleDueSignals } from '@/lib/settlement';

export async function GET() {
  settleDueSignals();
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const settings = getSettingsMap();
  const now = Date.now();
  const todayStart = getStartOfTodayUtcMs(now);

  const todayProfitRow = db
    .prepare(
      `SELECT COALESCE(SUM(expected_profit), 0) as total
       FROM signal_claims
       WHERE user_id = ? AND status = 'SETTLED' AND settled_at >= ?`
    )
    .get(user.id, todayStart) as { total: number };

  const pendingProfitRow = db
    .prepare(
      `SELECT COALESCE(SUM(expected_profit), 0) as total, COUNT(*) as cnt
       FROM signal_claims
       WHERE user_id = ? AND status = 'PENDING'`
    )
    .get(user.id) as { total: number; cnt: number };

  const recentLedger = db
    .prepare(
      `SELECT id, type, wallet_target, amount, balance_before, balance_after, note, created_at
       FROM ledger_transactions
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 12`
    )
    .all(user.id);

  const lockDays = Number(settings.withdraw_lock_days || '15');
  const lockStatus = getWithdrawLockStatus(user.first_deposit_at, lockDays, now);

  const isDepositActive = user.capital_balance >= 100 && user.first_deposit_at !== null;
  const isNewMemberWindow =
    user.first_deposit_at !== null && now - user.first_deposit_at <= 3 * 24 * 60 * 60 * 1000;

  return NextResponse.json({
    user: {
      uid: user.uid,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      referralCode: isDepositActive ? user.referral_code : null,
      capitalBalance: roundUsdt(user.capital_balance),
      profitBalance: roundUsdt(user.profit_balance),
      lockedProfitBalance: roundUsdt(user.locked_profit_balance),
      compoundingBase: roundUsdt(user.capital_balance + user.profit_balance),
      totalDeposited: roundUsdt(user.total_deposited),
      totalWithdrawn: roundUsdt(user.total_withdrawn),
      totalEarned: roundUsdt(user.total_earned),
      isDepositActive,
      isNewMemberWindow,
      bep20Address: user.bep20_address,
      bep20Locked: user.bep20_locked === 1,
      hasWithdrawPin: Boolean(user.withdraw_pin_hash),
      joinedAt: user.created_at,
    },
    metrics: {
      todayProfit: roundUsdt(todayProfitRow.total),
      pendingSettlementAmount: roundUsdt(pendingProfitRow.total),
      pendingSettlementCount: pendingProfitRow.cnt,
    },
    withdrawLock: lockStatus,
    schedule: {
      regularTimes: settings.signal_schedule_times || '16:00, 18:00, 20:00',
      extraTime: settings.extra_signal_time || '21:00',
      timezone: settings.timezone || 'Asia/Karachi',
      profitPercent: Number(settings.signal_default_profit_pct || '0.80'),
      validityMinutes: Number(settings.signal_validity_minutes || '30'),
      settleMinutes: Number(settings.signal_settle_minutes || '20'),
    },
    announcement: settings.announcement_text || '',
    supportContact: settings.support_contact || '',
    telegramGroupUrl: normalizeTelegramUrl(settings.telegram_group_url),
    telegramChannelUrl: normalizeTelegramUrl(settings.telegram_channel_url),
    recentLedger,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
