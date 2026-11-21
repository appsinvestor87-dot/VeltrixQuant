import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth';
import { ensurePaymentAccountQr, getDb, getSettingsMap } from '@/lib/db';
import { verifyBep20UsdtTx } from '@/lib/bscscan';
import { DEPOSIT_TIERS, validateTxHash } from '@/lib/quant-rules';

const depositSchema = z.object({
  amount: z.number().refine((v) => (DEPOSIT_TIERS as readonly number[]).includes(v), {
    message: 'Select a valid deposit tier ($100 to $5,000).',
  }),
  txHash: z.string().trim(),
  paymentAccountId: z.number().int().positive(),
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const settings = getSettingsMap();
  const accounts = db
    .prepare(
      'SELECT id, label, network, address, qr_data_url FROM payment_accounts WHERE is_active = 1 ORDER BY id DESC'
    )
    .all() as Array<{
    id: number;
    label: string;
    network: string;
    address: string;
    qr_data_url: string | null;
  }>;

  for (const acc of accounts) {
    if (!acc.qr_data_url) {
      acc.qr_data_url = await ensurePaymentAccountQr(acc.id, acc.address);
    }
  }

  const deposits = db
    .prepare(
      `SELECT d.id, d.amount, d.tx_hash, d.bsc_verified, d.bsc_details, d.status, d.review_note, d.created_at, d.reviewed_at,
              fa.allowance_amount as food_allowance_amount, fa.status as food_allowance_status
       FROM deposits d
       LEFT JOIN food_allowances fa ON fa.deposit_id = d.id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC
       LIMIT 25`
    )
    .all(user.id);

  return NextResponse.json({
    tiers: DEPOSIT_TIERS,
    accounts,
    deposits,
    rules: {
      firstDepositBonusPct: Number(settings.first_deposit_bonus_pct || '5'),
      foodAllowancePct: Number(settings.food_allowance_pct || '10'),
      foodAllowanceMin: Number(settings.food_allowance_min || '300'),
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = depositSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid deposit payload.' },
        { status: 400 }
      );
    }

    const { amount, txHash, paymentAccountId } = parsed.data;
    if (!validateTxHash(txHash)) {
      return NextResponse.json(
        { error: 'Invalid BEP20 TXID format (must start with 0x followed by 64 hex characters).' },
        { status: 400 }
      );
    }

    const db = getDb();
    const cleanTx = txHash.trim().toLowerCase();

    const dupTx = db
      .prepare('SELECT id FROM deposits WHERE LOWER(tx_hash) = ?')
      .get(cleanTx) as { id: number } | undefined;
    const dupDonationTx = db
      .prepare('SELECT id FROM donations WHERE LOWER(tx_hash) = ?')
      .get(cleanTx) as { id: number } | undefined;
    if (dupTx || dupDonationTx) {
      return NextResponse.json(
        { error: 'This TXID has already been submitted. Duplicate TXIDs are rejected.' },
        { status: 409 }
      );
    }

    const account = db
      .prepare('SELECT id, address FROM payment_accounts WHERE id = ? AND is_active = 1')
      .get(paymentAccountId) as { id: number; address: string } | undefined;
    if (!account) {
      return NextResponse.json({ error: 'Selected treasury wallet is inactive.' }, { status: 400 });
    }

    const bscResult = await verifyBep20UsdtTx({
      txHash: cleanTx,
      expectedRecipient: account.address,
      expectedAmount: amount,
    });

    const info = db
      .prepare(
        `INSERT INTO deposits (user_id, amount, tx_hash, payment_account_id, bsc_verified, bsc_details, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`
      )
      .run(
        user.id,
        amount,
        cleanTx,
        account.id,
        bscResult.verifiedOnChain ? 1 : 0,
        bscResult.summary,
        Date.now()
      );

    return NextResponse.json(
      {
        ok: true,
        depositId: Number(info.lastInsertRowid),
        bscVerification: bscResult,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Deposit submit error:', err);
    return NextResponse.json({ error: 'Unable to submit deposit request.' }, { status: 500 });
  }
}
