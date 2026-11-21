import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getSettingsMap, normalizeTelegramUrl, withTransaction } from '@/lib/db';

const settingsSchema = z.object({
  settings: z.record(z.string(), z.string().max(1000)),
});

const ALLOWED_KEYS = new Set([
  'withdraw_fee_percent',
  'min_withdraw_usdt',
  'withdraw_lock_days',
  'signal_default_profit_pct',
  'signal_validity_minutes',
  'signal_settle_minutes',
  'signal_schedule_times',
  'extra_signal_time',
  'first_deposit_bonus_pct',
  'direct_referral_bonus_pct',
  'food_allowance_pct',
  'food_allowance_min',
  'support_contact',
  'telegram_group_url',
  'telegram_channel_url',
  'announcement_text',
  'timezone',
  'admin_idle_lock_minutes',
]);

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const settings = getSettingsMap();
  const res = NextResponse.json({ settings });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid settings payload.' }, { status: 400 });
  }

  for (const key of ['telegram_group_url', 'telegram_channel_url'] as const) {
    const raw = (parsed.data.settings[key] || '').trim();
    if (raw && !normalizeTelegramUrl(raw)) {
      return NextResponse.json(
        {
          error: `Invalid ${key === 'telegram_group_url' ? 'Telegram Group' : 'Telegram Channel'} link. Enter a valid https://t.me/... or @handle.`,
        },
        { status: 400 }
      );
    }
  }

  const now = Date.now();
  const updatedKeys: string[] = [];

  withTransaction((tx) => {
    const stmt = tx.prepare(
      `INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    for (const [k, v] of Object.entries(parsed.data.settings)) {
      if (ALLOWED_KEYS.has(k)) {
        const finalVal =
          k === 'telegram_group_url' || k === 'telegram_channel_url'
            ? normalizeTelegramUrl(v)
            : v.trim();
        stmt.run(k, finalVal, now);
        updatedKeys.push(k);
      }
    }
  });

  logAdminAudit({
    admin: guard.admin,
    action: 'UPDATE_SYSTEM_SETTINGS',
    targetType: 'SETTINGS',
    targetId: 'PLATFORM',
    details: { updatedKeys },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true, updatedKeys, settings: getSettingsMap() });
  return attachRefreshedAdminCookie(res, guard.admin);
}

