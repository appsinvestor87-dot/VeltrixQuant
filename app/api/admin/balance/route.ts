import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { withTransaction } from '@/lib/db';
import { roundUsdt } from '@/lib/quant-rules';

const adjustSchema = z.object({
  userId: z.number().int().positive(),
  walletTarget: z.enum(['CAPITAL', 'PROFIT']),
  operation: z.enum(['ADD', 'DEDUCT']),
  amount: z.number().positive(),
  reason: z.string().trim().min(3, 'Audit reason is mandatory').max(200),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = adjustSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid adjustment payload.' },
        { status: 400 }
      );
    }

    const { userId, walletTarget, operation, amount, reason } = parsed.data;
    const ip = await getClientIp();
    const now = Date.now();

    const updated = withTransaction((tx) => {
      const user = tx
        .prepare('SELECT id, uid, username, capital_balance, profit_balance, first_deposit_at FROM users WHERE id = ?')
        .get(userId) as
        | {
            id: number;
            uid: string;
            username: string;
            capital_balance: number;
            profit_balance: number;
            first_deposit_at: number | null;
          }
        | undefined;
      if (!user) {
        throw new Error('User not found.');
      }

      const currentVal =
        walletTarget === 'CAPITAL' ? user.capital_balance : user.profit_balance;
      const delta = operation === 'ADD' ? amount : -amount;
      const nextVal = roundUsdt(currentVal + delta);
      if (nextVal < 0) {
        throw new Error('Adjustment would cause a negative balance.');
      }

      if (walletTarget === 'CAPITAL') {
        const firstDep = user.first_deposit_at ?? (operation === 'ADD' ? now : null);
        tx.prepare('UPDATE users SET capital_balance = ?, first_deposit_at = ? WHERE id = ?').run(
          nextVal,
          firstDep,
          userId
        );
      } else {
        tx.prepare('UPDATE users SET profit_balance = ? WHERE id = ?').run(nextVal, userId);
      }

      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        operation === 'ADD' ? 'ADMIN_CREDIT' : 'ADMIN_DEBIT',
        walletTarget,
        delta,
        currentVal,
        nextVal,
        `ADM-${guard.admin.adminId}`,
        `${guard.admin.displayName}: ${reason}`,
        now
      );

      return { uid: user.uid, username: user.username, before: currentVal, after: nextVal };
    });

    logAdminAudit({
      admin: guard.admin,
      action: `BALANCE_${operation}`,
      targetType: 'USER',
      targetId: updated.uid,
      details: {
        username: updated.username,
        walletTarget,
        amount,
        before: updated.before,
        after: updated.after,
        reason,
      },
      ipAddress: ip,
    });

    const res = NextResponse.json({ ok: true, result: updated });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to adjust balance.' }, { status: 500 });
  }
}
