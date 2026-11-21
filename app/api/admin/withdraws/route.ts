import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb, withTransaction } from '@/lib/db';
import { roundUsdt, validateTxHash } from '@/lib/quant-rules';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    id: z.number().int().positive(),
    action: z.literal('APPROVE'),
    payoutTxHash: z.string().trim(),
  }),
  z.object({
    id: z.number().int().positive(),
    action: z.literal('REJECT'),
    rejectReason: z.string().trim().min(3, 'Rejection reason is required').max(200),
  }),
]);

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const withdraws = getDb()
    .prepare(
      `SELECT w.*, u.uid, u.username, u.full_name, u.total_deposited, u.total_withdrawn, u.profit_balance
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       WHERE w.status = 'PENDING'
       ORDER BY w.created_at ASC`
    )
    .all();

  const res = NextResponse.json({ withdraws });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid withdrawal action.' },
        { status: 400 }
      );
    }

    const ip = await getClientIp();
    const now = Date.now();

    if (parsed.data.action === 'APPROVE') {
      const txHash = parsed.data.payoutTxHash.trim();
      if (!validateTxHash(txHash)) {
        return NextResponse.json(
          { error: 'Enter a valid BEP20 Payout TXID (0x + 64 hex chars).' },
          { status: 400 }
        );
      }

      const result = withTransaction((tx) => {
        const wd = tx.prepare('SELECT * FROM withdrawals WHERE id = ?').get(parsed.data.id) as
          | {
              id: number;
              user_id: number;
              gross_amount: number;
              net_amount: number;
              status: string;
            }
          | undefined;
        if (!wd) throw new Error('Withdrawal not found.');
        if (wd.status !== 'PENDING') throw new Error('Withdrawal already processed.');

        const user = tx
          .prepare('SELECT locked_profit_balance, total_withdrawn, uid FROM users WHERE id = ?')
          .get(wd.user_id) as {
          locked_profit_balance: number;
          total_withdrawn: number;
          uid: string;
        };

        const nextLocked = Math.max(0, roundUsdt(user.locked_profit_balance - wd.gross_amount));
        const nextWithdrawn = roundUsdt(user.total_withdrawn + wd.gross_amount);

        tx.prepare('UPDATE users SET locked_profit_balance = ?, total_withdrawn = ? WHERE id = ?').run(
          nextLocked,
          nextWithdrawn,
          wd.user_id
        );

        tx.prepare(
          "UPDATE withdrawals SET status = 'PAID', payout_tx_hash = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?"
        ).run(txHash, guard.admin.displayName, now, wd.id);

        return { wdId: wd.id, uid: user.uid, netAmount: wd.net_amount };
      });

      logAdminAudit({
        admin: guard.admin,
        action: 'APPROVE_WITHDRAW',
        targetType: 'WITHDRAW',
        targetId: result.wdId,
        details: { uid: result.uid, netAmount: result.netAmount, txHash },
        ipAddress: ip,
      });

      const res = NextResponse.json({ ok: true, status: 'PAID' });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    // REJECT -> Refund gross_amount from locked_profit_balance back to profit_balance!
    const rejData = parsed.data;
    const rejectResult = withTransaction((tx) => {
      const wd = tx.prepare('SELECT * FROM withdrawals WHERE id = ?').get(rejData.id) as
        | { id: number; user_id: number; gross_amount: number; status: string }
        | undefined;
      if (!wd) throw new Error('Withdrawal not found.');
      if (wd.status !== 'PENDING') throw new Error('Withdrawal already processed.');

      const user = tx
        .prepare('SELECT uid, profit_balance, locked_profit_balance FROM users WHERE id = ?')
        .get(wd.user_id) as {
        uid: string;
        profit_balance: number;
        locked_profit_balance: number;
      };

      const beforeProfit = roundUsdt(user.profit_balance);
      const afterProfit = roundUsdt(beforeProfit + wd.gross_amount);
      const afterLocked = Math.max(0, roundUsdt(user.locked_profit_balance - wd.gross_amount));

      tx.prepare('UPDATE users SET profit_balance = ?, locked_profit_balance = ? WHERE id = ?').run(
        afterProfit,
        afterLocked,
        wd.user_id
      );

      tx.prepare(
        "UPDATE withdrawals SET status = 'REJECTED', reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?"
      ).run(rejData.rejectReason, guard.admin.displayName, now, wd.id);

      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, 'WITHDRAW_REFUND', 'PROFIT', ?, ?, ?, ?, ?, ?)`
      ).run(
        wd.user_id,
        wd.gross_amount,
        beforeProfit,
        afterProfit,
        `WD-${wd.id}`,
        `Withdrawal rejected & refunded: ${rejData.rejectReason}`,
        now
      );

      return { wdId: wd.id, uid: user.uid, refunded: wd.gross_amount };
    });

    logAdminAudit({
      admin: guard.admin,
      action: 'REJECT_WITHDRAW',
      targetType: 'WITHDRAW',
      targetId: rejectResult.wdId,
      details: { uid: rejectResult.uid, refunded: rejectResult.refunded, reason: rejData.rejectReason },
      ipAddress: ip,
    });

    const res = NextResponse.json({ ok: true, status: 'REJECTED' });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to process withdrawal.' }, { status: 500 });
  }
}
