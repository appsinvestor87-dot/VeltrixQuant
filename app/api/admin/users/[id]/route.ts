import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { validateBep20Address, validateEmail, validateStrongPassword } from '@/lib/quant-rules';
import { getTeamTreeForUser } from '@/lib/settlement';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, uid, username, full_name, email, referral_code, referred_by_id,
              bep20_address, bep20_locked, capital_balance, profit_balance, locked_profit_balance,
              total_deposited, total_withdrawn, total_earned, first_deposit_at, status, block_reason,
              last_login_ip, created_at
       FROM users WHERE id = ?`
    )
    .get(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const ledger = db
    .prepare('SELECT * FROM ledger_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 40')
    .all(userId);
  const claims = db
    .prepare(
      `SELECT sc.*, s.signal_code, s.pair, s.signal_type
       FROM signal_claims sc JOIN signals s ON s.id = sc.signal_id
       WHERE sc.user_id = ? ORDER BY sc.claimed_at DESC LIMIT 30`
    )
    .all(userId);
  const deposits = db
    .prepare('SELECT * FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId);
  const withdrawals = db
    .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId);
  const team = getTeamTreeForUser(userId);

  const res = NextResponse.json({ user, ledger, claims, deposits, withdrawals, team });
  return attachRefreshedAdminCookie(res, guard.admin);
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('BLOCK'),
    reason: z.string().trim().min(3, 'Block reason is required').max(200),
  }),
  z.object({
    action: z.literal('UNBLOCK'),
  }),
  z.object({
    action: z.literal('EDIT_PROFILE'),
    fullName: z.string().trim().min(2).max(64),
    email: z.string().trim().email(),
  }),
  z.object({
    action: z.literal('RESET_PASSWORD'),
    newPassword: z.string().min(8).max(128),
  }),
  z.object({
    action: z.literal('RESET_PIN'),
    newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits').optional(),
  }),
  z.object({
    action: z.literal('UPDATE_WALLET'),
    bep20Address: z.string().trim().optional(),
    unlockOnly: z.boolean().optional(),
  }),
]);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid update payload' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = await getClientIp();
    const existing = db
      .prepare('SELECT id, uid, username, full_name, email, status, bep20_address FROM users WHERE id = ?')
      .get(userId) as
      | {
          id: number;
          uid: string;
          username: string;
          full_name: string;
          email: string;
          status: string;
          bep20_address: string | null;
        }
      | undefined;

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (parsed.data.action === 'BLOCK') {
      db.prepare(
        "UPDATE users SET status = 'BLOCKED', block_reason = ?, token_version = token_version + 1 WHERE id = ?"
      ).run(parsed.data.reason, userId);

      logAdminAudit({
        admin: guard.admin,
        action: 'BLOCK_USER',
        targetType: 'USER',
        targetId: existing.uid,
        details: { username: existing.username, reason: parsed.data.reason },
        ipAddress: ip,
      });
    } else if (parsed.data.action === 'UNBLOCK') {
      db.prepare("UPDATE users SET status = 'ACTIVE', block_reason = NULL WHERE id = ?").run(userId);
      logAdminAudit({
        admin: guard.admin,
        action: 'UNBLOCK_USER',
        targetType: 'USER',
        targetId: existing.uid,
        details: { username: existing.username },
        ipAddress: ip,
      });
    } else if (parsed.data.action === 'EDIT_PROFILE') {
      if (!validateEmail(parsed.data.email)) {
        return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
      }
      const dup = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
        .get(parsed.data.email, userId) as { id: number } | undefined;
      if (dup) {
        return NextResponse.json({ error: 'Email already used by another user.' }, { status: 409 });
      }
      db.prepare(
        'UPDATE users SET full_name = ?, email = ?, token_version = token_version + 1 WHERE id = ?'
      ).run(parsed.data.fullName, parsed.data.email.toLowerCase(), userId);

      logAdminAudit({
        admin: guard.admin,
        action: 'EDIT_USER_PROFILE',
        targetType: 'USER',
        targetId: existing.uid,
        details: {
          oldName: existing.full_name,
          newName: parsed.data.fullName,
          oldEmail: existing.email,
          newEmail: parsed.data.email.toLowerCase(),
        },
        ipAddress: ip,
      });
    } else if (parsed.data.action === 'RESET_PASSWORD') {
      const pwCheck = validateStrongPassword(parsed.data.newPassword);
      if (!pwCheck.valid) {
        return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
      }
      const hash = bcrypt.hashSync(parsed.data.newPassword, 10);
      db.prepare(
        'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?'
      ).run(hash, userId);

      logAdminAudit({
        admin: guard.admin,
        action: 'RESET_USER_PASSWORD',
        targetType: 'USER',
        targetId: existing.uid,
        details: { username: existing.username },
        ipAddress: ip,
      });
    } else if (parsed.data.action === 'RESET_PIN') {
      const pinHash = parsed.data.newPin ? bcrypt.hashSync(parsed.data.newPin, 10) : null;
      db.prepare('UPDATE users SET withdraw_pin_hash = ? WHERE id = ?').run(pinHash, userId);
      logAdminAudit({
        admin: guard.admin,
        action: 'RESET_WITHDRAW_PIN',
        targetType: 'USER',
        targetId: existing.uid,
        details: { clearedToNull: !parsed.data.newPin },
        ipAddress: ip,
      });
    } else if (parsed.data.action === 'UPDATE_WALLET') {
      if (parsed.data.unlockOnly) {
        db.prepare('UPDATE users SET bep20_locked = 0 WHERE id = ?').run(userId);
        logAdminAudit({
          admin: guard.admin,
          action: 'UNLOCK_BEP20_WALLET',
          targetType: 'USER',
          targetId: existing.uid,
          details: { previousAddress: existing.bep20_address },
          ipAddress: ip,
        });
      } else {
        const addr = parsed.data.bep20Address?.trim() || '';
        if (!validateBep20Address(addr)) {
          return NextResponse.json({ error: 'Invalid BEP20 address format.' }, { status: 400 });
        }
        db.prepare('UPDATE users SET bep20_address = ?, bep20_locked = 1 WHERE id = ?').run(
          addr,
          userId
        );
        logAdminAudit({
          admin: guard.admin,
          action: 'UPDATE_BEP20_WALLET',
          targetType: 'USER',
          targetId: existing.uid,
          details: { previousAddress: existing.bep20_address, newAddress: addr },
          ipAddress: ip,
        });
      }
    }

    const res = NextResponse.json({ ok: true });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    console.error('Admin user patch error:', err);
    return NextResponse.json({ error: 'Unable to update user.' }, { status: 500 });
  }
}
