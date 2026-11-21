import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb, getSettingsMap } from '@/lib/db';
import { settleDueSignals } from '@/lib/settlement';

const createSignalSchema = z.object({
  pair: z.string().trim().min(3).max(20).default('BTC/USDT'),
  direction: z.enum(['LONG', 'SHORT']).default('LONG'),
  signalType: z.enum(['REGULAR', 'ADDITIONAL']).default('REGULAR'),
  profitPercent: z.number().min(0.1).max(25),
  startsAtMs: z.number().int().positive().optional(),
  validityMinutes: z.number().int().min(5).max(180).default(30),
  settleDelayMinutes: z.number().int().min(1).max(180).default(20),
  note: z.string().trim().max(160).optional(),
  customCode: z.string().trim().max(32).optional(),
  targetIdentifier: z.string().trim().max(64).optional(),
  isTest: z.boolean().default(false),
});

const patchSignalSchema = z.object({
  id: z.number().int().positive(),
  startsAtMs: z.number().int().positive(),
  expiresAtMs: z.number().int().positive(),
  profitPercent: z.number().min(0.1).max(25),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  settleDueSignals();
  const db = getDb();
  const settings = getSettingsMap();

  const signals = db
    .prepare(
      `SELECT s.*,
              tu.username as target_username,
              tu.uid as target_uid,
              (SELECT COUNT(*) FROM signal_claims sc WHERE sc.signal_id = s.id) as claims_count,
              (SELECT COALESCE(SUM(sc.expected_profit), 0) FROM signal_claims sc WHERE sc.signal_id = s.id) as total_profit_allocated
       FROM signals s
       LEFT JOIN users tu ON tu.id = s.target_user_id
       ORDER BY s.starts_at DESC`
    )
    .all();

  const res = NextResponse.json({
    signals,
    defaults: {
      profitPercent: Number(settings.signal_default_profit_pct || '0.80'),
      validityMinutes: Number(settings.signal_validity_minutes || '30'),
      settleDelayMinutes: Number(settings.signal_settle_minutes || '20'),
      regularTimes: settings.signal_schedule_times || '16:00, 18:00, 20:00',
      extraTime: settings.extra_signal_time || '21:00',
      timezone: settings.timezone || 'Asia/Karachi',
    },
  });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = createSignalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid signal configuration.' },
        { status: 400 }
      );
    }

    const now = Date.now();
    const startsAt = parsed.data.startsAtMs ?? now;
    const expiresAt = startsAt + parsed.data.validityMinutes * 60 * 1000;
    const db = getDb();

    let targetUser: { id: number; uid: string; username: string } | undefined;
    const rawTarget = parsed.data.targetIdentifier?.trim().replace(/^@+/, '');
    if (rawTarget) {
      targetUser = db
        .prepare('SELECT id, uid, username FROM users WHERE LOWER(username) = LOWER(?) OR UPPER(uid) = UPPER(?)')
        .get(rawTarget, rawTarget) as { id: number; uid: string; username: string } | undefined;
      if (!targetUser) {
        return NextResponse.json(
          { error: 'Target member not found (check UID or username).' },
          { status: 400 }
        );
      }
    }

    const generateUniqueSignalCode = (signalType: 'REGULAR' | 'ADDITIONAL'): string => {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const prefix = parsed.data.isTest
        ? 'VQ-TST-'
        : signalType === 'ADDITIONAL'
          ? 'VQ-EXT-'
          : 'VQ-SIG-';
      for (let attempt = 0; attempt < 10; attempt++) {
        let suffix = '';
        const bytes = crypto.randomBytes(6);
        for (let i = 0; i < 6; i++) {
          suffix += alphabet[bytes[i] % alphabet.length];
        }
        const candidate = `${prefix}${suffix}`;
        const exists = db
          .prepare('SELECT id FROM signals WHERE UPPER(signal_code) = ?')
          .get(candidate);
        if (!exists) return candidate;
      }
      return `${prefix}${Date.now().toString(36).slice(-6).toUpperCase()}`;
    };

    const code =
      parsed.data.customCode && parsed.data.customCode.length >= 4
        ? parsed.data.customCode.trim().toUpperCase()
        : generateUniqueSignalCode(parsed.data.signalType);
    const info = db
      .prepare(
        `INSERT INTO signals
         (signal_code, pair, direction, signal_type, profit_percent, starts_at, expires_at, settle_delay_minutes, note, target_user_id, is_test, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        code,
        parsed.data.pair.toUpperCase(),
        parsed.data.direction,
        parsed.data.signalType,
        parsed.data.profitPercent,
        startsAt,
        expiresAt,
        parsed.data.settleDelayMinutes,
        parsed.data.note || null,
        targetUser ? targetUser.id : null,
        parsed.data.isTest ? 1 : 0,
        guard.admin.displayName,
        now
      );

    logAdminAudit({
      admin: guard.admin,
      action: 'GENERATE_SIGNAL',
      targetType: 'SIGNAL',
      targetId: code,
      details: {
        pair: parsed.data.pair,
        signalType: parsed.data.signalType,
        profitPercent: parsed.data.profitPercent,
        validityMinutes: parsed.data.validityMinutes,
        targetUserId: targetUser ? targetUser.id : null,
        targetUsername: targetUser ? targetUser.username : null,
        isTest: parsed.data.isTest,
      },
      ipAddress: await getClientIp(),
    });

    const res = NextResponse.json(
      {
        ok: true,
        signal: {
          id: Number(info.lastInsertRowid),
          signal_code: code,
          pair: parsed.data.pair.toUpperCase(),
          direction: parsed.data.direction,
          signal_type: parsed.data.signalType,
          profit_percent: parsed.data.profitPercent,
          starts_at: startsAt,
          expires_at: expiresAt,
          settle_delay_minutes: parsed.data.settleDelayMinutes,
          target_user_id: targetUser ? targetUser.id : null,
          target_username: targetUser ? targetUser.username : null,
          target_uid: targetUser ? targetUser.uid : null,
          is_test: parsed.data.isTest ? 1 : 0,
        },
      },
      { status: 201 }
    );
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    console.error('Signal create error:', err);
    return NextResponse.json({ error: 'Unable to generate signal (code may already exist).' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = patchSignalSchema.safeParse(body);
  if (!parsed.success || parsed.data.expiresAtMs <= parsed.data.startsAtMs) {
    return NextResponse.json({ error: 'Invalid signal timing update.' }, { status: 400 });
  }

  getDb()
    .prepare(
      'UPDATE signals SET starts_at = ?, expires_at = ?, profit_percent = ? WHERE id = ?'
    )
    .run(parsed.data.startsAtMs, parsed.data.expiresAtMs, parsed.data.profitPercent, parsed.data.id);

  logAdminAudit({
    admin: guard.admin,
    action: 'UPDATE_SIGNAL_TIMING',
    targetType: 'SIGNAL',
    targetId: parsed.data.id,
    details: {
      startsAtMs: parsed.data.startsAtMs,
      expiresAtMs: parsed.data.expiresAtMs,
      profitPercent: parsed.data.profitPercent,
    },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}
