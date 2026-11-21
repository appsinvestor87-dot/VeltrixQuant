import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDb, getSettingsMap, normalizeTelegramUrl } from '@/lib/db';
import { processSupportMessage } from '@/lib/chatbot-engine';

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Enter a message').max(500),
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const history = getDb()
    .prepare(
      `SELECT id, message, reply, is_red_flag, created_at
       FROM chatbot_logs
       WHERE user_id = ?
       ORDER BY created_at ASC
       LIMIT 40`
    )
    .all(user.id);

  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Message is invalid.' },
        { status: 400 }
      );
    }

    const settings = getSettingsMap();
    const result = processSupportMessage(parsed.data.message, {
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
    });

    const now = Date.now();
    const info = getDb()
      .prepare(
        `INSERT INTO chatbot_logs (user_id, username, message, reply, is_red_flag, flag_reason, reviewed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
      )
      .run(
        user.id,
        user.username,
        parsed.data.message,
        result.reply,
        result.isRedFlag ? 1 : 0,
        result.flagReason,
        now
      );

    return NextResponse.json({
      ok: true,
      entry: {
        id: Number(info.lastInsertRowid),
        message: parsed.data.message,
        reply: result.reply,
        is_red_flag: result.isRedFlag ? 1 : 0,
        created_at: now,
      },
    });
  } catch (err) {
    console.error('Chat error:', err);
    return NextResponse.json({ error: 'Unable to process message.' }, { status: 500 });
  }
}
