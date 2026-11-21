import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDb, getSalaryLevels, getSettingsMap, normalizeTelegramUrl } from '@/lib/db';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const settings = getSettingsMap();
  const salaryLevels = getSalaryLevels();
  const resources = db
    .prepare(
      `SELECT id, title, resource_type, description, file_data_url, file_name, created_at
       FROM about_resources
       ORDER BY created_at DESC`
    )
    .all();

  return NextResponse.json({
    rules: {
      withdrawFeePercent: Number(settings.withdraw_fee_percent || '3'),
      minWithdrawUsdt: Number(settings.min_withdraw_usdt || '10'),
      withdrawLockDays: Number(settings.withdraw_lock_days || '15'),
      signalProfitPercent: Number(settings.signal_default_profit_pct || '0.80'),
      signalValidityMinutes: Number(settings.signal_validity_minutes || '30'),
      signalSettleMinutes: Number(settings.signal_settle_minutes || '20'),
      regularSchedule: settings.signal_schedule_times || '16:00, 18:00, 20:00',
      extraSignalTime: settings.extra_signal_time || '21:00',
      firstDepositBonusPct: Number(settings.first_deposit_bonus_pct || '5'),
      directReferralBonusPct: Number(settings.direct_referral_bonus_pct || '7'),
      foodAllowancePct: Number(settings.food_allowance_pct || '10'),
      foodAllowanceMin: Number(settings.food_allowance_min || '300'),
      supportContact: settings.support_contact || '+1 (800) 555-0199',
      telegramGroupUrl: normalizeTelegramUrl(settings.telegram_group_url),
      telegramChannelUrl: normalizeTelegramUrl(settings.telegram_channel_url),
      timezone: settings.timezone || 'Asia/Karachi',
    },
    salaryLevels,
    resources,
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
