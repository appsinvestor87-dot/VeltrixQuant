import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { verifyBep20UsdtTx } from '@/lib/bscscan';
import { getDb, getSettingsMap, withTransaction } from '@/lib/db';
import { calculateDepositBonuses, roundUsdt } from '@/lib/quant-rules';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('VERIFY_BSCSCAN') }),
  z.object({
    action: z.literal('APPROVE'),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal('REJECT'),
    note: z.string().trim().min(3, 'Rejection reason is required').max(200),
  }),
]);

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const depositId = Number(id);
  if (!Number.isInteger(depositId) || depositId <= 0) {
    return NextResponse.json({ error: 'Invalid deposit ID' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid deposit action.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = await getClientIp();

    if (parsed.data.action === 'VERIFY_BSCSCAN') {
      const dep = db
        .prepare(
          `SELECT d.id, d.amount, d.tx_hash, pa.address as treasury_address
           FROM deposits d
           LEFT JOIN payment_accounts pa ON pa.id = d.payment_account_id
           WHERE d.id = ?`
        )
        .get(depositId) as
        | { id: number; amount: number; tx_hash: string; treasury_address: string | null }
        | undefined;
      if (!dep) {
        return NextResponse.json({ error: 'Deposit not found.' }, { status: 404 });
      }
      const bsc = await verifyBep20UsdtTx({
        txHash: dep.tx_hash,
        expectedRecipient: dep.treasury_address || '',
        expectedAmount: dep.amount,
      });
      db.prepare('UPDATE deposits SET bsc_verified = ?, bsc_details = ? WHERE id = ?').run(
        bsc.verifiedOnChain ? 1 : 0,
        bsc.summary,
        depositId
      );
      const res = NextResponse.json({ ok: true, bscVerification: bsc });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    const now = Date.now();
    const settings = getSettingsMap();
    const firstDepositBonusPct = Number(settings.first_deposit_bonus_pct || '5');
    const directReferralBonusPct = Number(settings.direct_referral_bonus_pct || '7');
    const foodAllowancePct = Number(settings.food_allowance_pct || '10');
    const foodAllowanceMin = Number(settings.food_allowance_min || '300');

    if (parsed.data.action === 'REJECT') {
      const rejectNote = parsed.data.note;
      withTransaction((tx) => {
        const dep = tx.prepare('SELECT id, status, user_id, amount FROM deposits WHERE id = ?').get(depositId) as
          | { id: number; status: string; user_id: number; amount: number }
          | undefined;
        if (!dep) throw new Error('Deposit not found.');
        if (dep.status !== 'PENDING') throw new Error('Deposit has already been processed.');

        tx.prepare(
          "UPDATE deposits SET status = 'REJECTED', reviewed_by = ?, review_note = ?, reviewed_at = ? WHERE id = ?"
        ).run(guard.admin.displayName, rejectNote, now, depositId);
      });

      logAdminAudit({
        admin: guard.admin,
        action: 'REJECT_DEPOSIT',
        targetType: 'DEPOSIT',
        targetId: depositId,
        details: { reason: rejectNote },
        ipAddress: ip,
      });

      const res = NextResponse.json({ ok: true, status: 'REJECTED' });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    // APPROVE (Atomic Capital + 5% First Deposit Profit + 7% Sponsor Profit + 10% Food Allowance)
    const approveNote = parsed.data.note || 'Approved by Admin';
    const approvalResult = withTransaction((tx) => {
      const dep = tx
        .prepare('SELECT id, user_id, amount, tx_hash, status FROM deposits WHERE id = ?')
        .get(depositId) as
        | { id: number; user_id: number; amount: number; tx_hash: string; status: string }
        | undefined;
      if (!dep) throw new Error('Deposit not found.');
      if (dep.status !== 'PENDING') throw new Error('Deposit has already been processed.');

      const user = tx
        .prepare(
          `SELECT id, uid, username, referred_by_id, bep20_address,
                  capital_balance, profit_balance, total_deposited, total_earned, first_deposit_at
           FROM users WHERE id = ?`
        )
        .get(dep.user_id) as {
        id: number;
        uid: string;
        username: string;
        referred_by_id: number | null;
        bep20_address: string | null;
        capital_balance: number;
        profit_balance: number;
        total_deposited: number;
        total_earned: number;
        first_deposit_at: number | null;
      };

      const isFirstDeposit = user.first_deposit_at === null && user.total_deposited === 0;
      const bonuses = calculateDepositBonuses({
        amount: dep.amount,
        isFirstDeposit,
        firstDepositBonusPct,
        directReferralBonusPct,
        foodAllowancePct,
        foodAllowanceMin,
      });

      const beforeCapital = roundUsdt(user.capital_balance);
      const afterCapital = roundUsdt(beforeCapital + dep.amount);
      const afterTotalDep = roundUsdt(user.total_deposited + dep.amount);
      const beforeProfit = roundUsdt(user.profit_balance);
      const afterProfit = roundUsdt(beforeProfit + bonuses.userFirstDepositBonus);
      const afterEarned = roundUsdt(user.total_earned + bonuses.userFirstDepositBonus);
      const firstDepTs = user.first_deposit_at ?? now;

      tx.prepare(
        `UPDATE users
         SET capital_balance = ?, profit_balance = ?, total_deposited = ?, total_earned = ?, first_deposit_at = ?
         WHERE id = ?`
      ).run(afterCapital, afterProfit, afterTotalDep, afterEarned, firstDepTs, user.id);

      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, 'DEPOSIT_CAPITAL', 'CAPITAL', ?, ?, ?, ?, ?, ?)`
      ).run(
        user.id,
        dep.amount,
        beforeCapital,
        afterCapital,
        `DEP-${dep.id}`,
        `Approved BEP20 Deposit ($${dep.amount})`,
        now
      );

      if (bonuses.userFirstDepositBonus > 0) {
        tx.prepare(
          `INSERT INTO ledger_transactions
           (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
           VALUES (?, 'FIRST_DEPOSIT_BONUS', 'PROFIT', ?, ?, ?, ?, ?, ?)`
        ).run(
          user.id,
          bonuses.userFirstDepositBonus,
          beforeProfit,
          afterProfit,
          `DEP-${dep.id}`,
          `${firstDepositBonusPct}% First Deposit Bonus`,
          now
        );
      }

      if (user.referred_by_id && bonuses.sponsorReferralBonus > 0) {
        const sponsor = tx
          .prepare('SELECT id, profit_balance, total_earned FROM users WHERE id = ?')
          .get(user.referred_by_id) as
          | { id: number; profit_balance: number; total_earned: number }
          | undefined;
        if (sponsor) {
          const spBefore = roundUsdt(sponsor.profit_balance);
          const spAfter = roundUsdt(spBefore + bonuses.sponsorReferralBonus);
          tx.prepare('UPDATE users SET profit_balance = ?, total_earned = ? WHERE id = ?').run(
            spAfter,
            roundUsdt(sponsor.total_earned + bonuses.sponsorReferralBonus),
            sponsor.id
          );
          tx.prepare(
            `INSERT INTO ledger_transactions
             (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
             VALUES (?, 'REFERRAL_BONUS', 'PROFIT', ?, ?, ?, ?, ?, ?)`
          ).run(
            sponsor.id,
            bonuses.sponsorReferralBonus,
            spBefore,
            spAfter,
            `DEP-${dep.id}`,
            `${directReferralBonusPct}% Direct Referral Bonus from ${user.username} ($${dep.amount})`,
            now
          );
        }
      }

      if (bonuses.qualifiesForFoodAllowance) {
        tx.prepare(
          `INSERT INTO food_allowances
           (deposit_id, user_id, deposit_amount, allowance_amount, bep20_address, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
        ).run(
          dep.id,
          user.id,
          dep.amount,
          bonuses.foodAllowanceAmount,
          user.bep20_address,
          now
        );
      }

      tx.prepare(
        "UPDATE deposits SET status = 'APPROVED', reviewed_by = ?, review_note = ?, reviewed_at = ? WHERE id = ?"
      ).run(
        guard.admin.displayName,
        approveNote,
        now,
        dep.id
      );

      return {
        uid: user.uid,
        username: user.username,
        amount: dep.amount,
        bonuses,
      };
    });

    logAdminAudit({
      admin: guard.admin,
      action: 'APPROVE_DEPOSIT',
      targetType: 'DEPOSIT',
      targetId: depositId,
      details: approvalResult,
      ipAddress: ip,
    });

    const res = NextResponse.json({ ok: true, status: 'APPROVED', result: approvalResult });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Unable to process deposit.' }, { status: 500 });
  }
}
