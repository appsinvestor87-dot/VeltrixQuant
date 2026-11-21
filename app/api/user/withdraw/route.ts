import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth';
import { getDb, getSettingsMap, withTransaction } from '@/lib/db';
import {
  calculateWithdrawBreakdown,
  getWithdrawLockStatus,
  roundUsdt,
  validateBep20Address,
} from '@/lib/quant-rules';
import { getStartOfTodayUtcMs, settleDueSignals } from '@/lib/settlement';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('BIND_WALLET'),
    bep20Address: z.string().trim(),
    withdrawPin: z.string().regex(/^\d{4,6}$/, 'Withdraw PIN must be 4 to 6 digits'),
  }),
  z.object({
    action: z.literal('SET_PIN'),
    withdrawPin: z.string().regex(/^\d{4,6}$/, 'Withdraw PIN must be 4 to 6 digits'),
  }),
  z.object({
    action: z.literal('REQUEST_WITHDRAW'),
    amount: z.number().positive(),
    withdrawPin: z.string().min(4).max(6),
  }),
]);

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

  const lockDays = Number(settings.withdraw_lock_days || '15');
  const feePercent = Number(settings.withdraw_fee_percent || '3');
  const minWithdraw = Number(settings.min_withdraw_usdt || '10');
  const lockStatus = getWithdrawLockStatus(user.first_deposit_at, lockDays, now);

  const todayRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM withdrawals
       WHERE user_id = ? AND status != 'REJECTED' AND created_at >= ?`
    )
    .get(user.id, todayStart) as { cnt: number };

  const withdrawals = db
    .prepare(
      `SELECT id, bep20_address, gross_amount, fee_percent, fee_amount, net_amount, status,
              payout_tx_hash, reject_reason, created_at, reviewed_at
       FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`
    )
    .all(user.id);

  return NextResponse.json({
    wallet: {
      bep20Address: user.bep20_address,
      bep20Locked: user.bep20_locked === 1,
      hasWithdrawPin: Boolean(user.withdraw_pin_hash),
      capitalBalance: roundUsdt(user.capital_balance),
      profitBalance: roundUsdt(user.profit_balance),
      lockedProfitBalance: roundUsdt(user.locked_profit_balance),
    },
    rules: {
      feePercent,
      minWithdraw,
      lockDays,
      todayWithdrawCount: todayRow.cnt,
      dailyLimit: 1,
    },
    lockStatus,
    withdrawals,
  });
}

export async function POST(req: NextRequest) {
  settleDueSignals();
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid withdrawal action.' },
        { status: 400 }
      );
    }

    const db = getDb();

    if (parsed.data.action === 'BIND_WALLET') {
      if (user.bep20_locked === 1 && user.bep20_address) {
        return NextResponse.json(
          { error: 'BEP20 address is permanently locked. Contact Admin to update.' },
          { status: 403 }
        );
      }
      if (!validateBep20Address(parsed.data.bep20Address)) {
        return NextResponse.json(
          { error: 'Invalid BEP20 address (must be 0x followed by 40 hex characters).' },
          { status: 400 }
        );
      }
      const pinHash = user.withdraw_pin_hash || bcrypt.hashSync(parsed.data.withdrawPin, 10);
      db.prepare(
        'UPDATE users SET bep20_address = ?, bep20_locked = 1, withdraw_pin_hash = ? WHERE id = ?'
      ).run(parsed.data.bep20Address.trim(), pinHash, user.id);

      return NextResponse.json({ ok: true, bep20Address: parsed.data.bep20Address.trim() });
    }

    if (parsed.data.action === 'SET_PIN') {
      if (user.withdraw_pin_hash) {
        return NextResponse.json(
          { error: 'Withdraw PIN is already set. Contact Admin for a PIN reset.' },
          { status: 403 }
        );
      }
      const pinHash = bcrypt.hashSync(parsed.data.withdrawPin, 10);
      db.prepare('UPDATE users SET withdraw_pin_hash = ? WHERE id = ?').run(pinHash, user.id);
      return NextResponse.json({ ok: true });
    }

    // REQUEST_WITHDRAW
    if (!user.withdraw_pin_hash || !bcrypt.compareSync(parsed.data.withdrawPin, user.withdraw_pin_hash)) {
      return NextResponse.json({ error: 'Invalid Withdraw PIN.' }, { status: 401 });
    }

    const settings = getSettingsMap();
    const lockDays = Number(settings.withdraw_lock_days || '15');
    const feePercent = Number(settings.withdraw_fee_percent || '3');
    const minWithdraw = Number(settings.min_withdraw_usdt || '10');
    const now = Date.now();
    const todayStart = getStartOfTodayUtcMs(now);

    const reqAmount = parsed.data.amount;
    const created = withTransaction((tx) => {
      const freshUser = tx
        .prepare(
          'SELECT bep20_address, bep20_locked, profit_balance, locked_profit_balance, first_deposit_at FROM users WHERE id = ?'
        )
        .get(user.id) as {
        bep20_address: string | null;
        bep20_locked: number;
        profit_balance: number;
        locked_profit_balance: number;
        first_deposit_at: number | null;
      };

      const lockStatus = getWithdrawLockStatus(freshUser.first_deposit_at, lockDays, now);
      const todayRow = tx
        .prepare(
          `SELECT COUNT(*) as cnt FROM withdrawals
           WHERE user_id = ? AND status != 'REJECTED' AND created_at >= ?`
        )
        .get(user.id, todayStart) as { cnt: number };

      const check = calculateWithdrawBreakdown({
        requestedAmount: reqAmount,
        profitBalance: freshUser.profit_balance,
        feePercent,
        minWithdraw,
        unlocked: lockStatus.unlocked,
        todayWithdrawCount: todayRow.cnt,
        hasWalletBound: Boolean(freshUser.bep20_address && freshUser.bep20_locked === 1),
      });

      if (!check.valid) {
        throw new Error(check.reason || 'Withdrawal validation failed.');
      }

      const beforeProfit = roundUsdt(freshUser.profit_balance);
      const afterProfit = roundUsdt(beforeProfit - reqAmount);
      const afterLocked = roundUsdt(freshUser.locked_profit_balance + reqAmount);

      tx.prepare(
        'UPDATE users SET profit_balance = ?, locked_profit_balance = ? WHERE id = ?'
      ).run(afterProfit, afterLocked, user.id);

      const info = tx
        .prepare(
          `INSERT INTO withdrawals
           (user_id, bep20_address, gross_amount, fee_percent, fee_amount, net_amount, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`
        )
        .run(
          user.id,
          freshUser.bep20_address!,
          reqAmount,
          feePercent,
          check.feeAmount,
          check.netAmount,
          now
        );

      const wdId = Number(info.lastInsertRowid);
      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, 'WITHDRAW_HOLD', 'PROFIT', ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        -reqAmount,
        beforeProfit,
        afterProfit,
        `WD-${wdId}`,
        `Withdrawal hold ($${check.netAmount} net after ${feePercent}% fee)`,
        now
      );

      return {
        id: wdId,
        grossAmount: reqAmount,
        feeAmount: check.feeAmount,
        netAmount: check.netAmount,
      };
    });

    return NextResponse.json({ ok: true, withdrawal: created }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to submit withdrawal.' }, { status: 500 });
  }
}
