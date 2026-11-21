import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth';
import { verifyBep20UsdtTx } from '@/lib/bscscan';
import { ensureDonationAccountQr, getDb } from '@/lib/db';
import {
  MIN_DONATION_USDT,
  roundUsdt,
  validateDonationAmount,
  validateTxHash,
} from '@/lib/quant-rules';

const donateSchema = z.object({
  amount: z.number(),
  txHash: z.string().trim(),
  donationAccountId: z.number().int().positive(),
  note: z.string().trim().max(160).optional(),
});

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const accounts = db
    .prepare(
      'SELECT id, label, network, address, qr_data_url FROM donation_accounts WHERE is_active = 1 ORDER BY id DESC'
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
      acc.qr_data_url = await ensureDonationAccountQr(acc.id, acc.address);
    }
  }

  const donations = db
    .prepare(
      `SELECT dn.id, dn.amount, dn.tx_hash, dn.note, dn.bsc_verified, dn.bsc_details,
              dn.status, dn.review_note, dn.created_at, dn.reviewed_at,
              da.label as account_label, da.address as donation_address
       FROM donations dn
       LEFT JOIN donation_accounts da ON da.id = dn.donation_account_id
       WHERE dn.user_id = ?
       ORDER BY dn.created_at DESC
       LIMIT 30`
    )
    .all(user.id);

  const summary = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as totalApproved,
              COUNT(*) as totalCount
       FROM donations WHERE user_id = ?`
    )
    .get(user.id) as { totalApproved: number; totalCount: number };

  return NextResponse.json({
    minDonationUsdt: MIN_DONATION_USDT,
    accounts,
    donations,
    totalApprovedDonated: roundUsdt(summary.totalApproved || 0),
    totalSubmissions: summary.totalCount || 0,
  });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = donateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid donation submission.' },
        { status: 400 }
      );
    }

    const amountCheck = validateDonationAmount(parsed.data.amount);
    if (!amountCheck.valid) {
      return NextResponse.json({ error: amountCheck.reason }, { status: 400 });
    }
    const cleanAmount = roundUsdt(parsed.data.amount);

    if (!validateTxHash(parsed.data.txHash)) {
      return NextResponse.json(
        { error: 'Invalid BEP20 TXID format (must start with 0x followed by 64 hex characters).' },
        { status: 400 }
      );
    }

    const db = getDb();
    const cleanTx = parsed.data.txHash.trim().toLowerCase();

    const dupDonation = db
      .prepare('SELECT id FROM donations WHERE LOWER(tx_hash) = ?')
      .get(cleanTx) as { id: number } | undefined;
    const dupDeposit = db
      .prepare('SELECT id FROM deposits WHERE LOWER(tx_hash) = ?')
      .get(cleanTx) as { id: number } | undefined;
    if (dupDonation || dupDeposit) {
      return NextResponse.json(
        { error: 'This TXID has already been used on the platform. Duplicate TXIDs are rejected.' },
        { status: 409 }
      );
    }

    const account = db
      .prepare('SELECT id, address FROM donation_accounts WHERE id = ? AND is_active = 1')
      .get(parsed.data.donationAccountId) as { id: number; address: string } | undefined;
    if (!account) {
      return NextResponse.json(
        { error: 'Selected donation receiving wallet is inactive.' },
        { status: 400 }
      );
    }

    const bscResult = await verifyBep20UsdtTx({
      txHash: cleanTx,
      expectedRecipient: account.address,
      expectedAmount: cleanAmount,
    });

    const cleanNote = parsed.data.note?.trim() || null;
    const info = db
      .prepare(
        `INSERT INTO donations
         (user_id, amount, tx_hash, donation_account_id, note, bsc_verified, bsc_details, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`
      )
      .run(
        user.id,
        cleanAmount,
        cleanTx,
        account.id,
        cleanNote,
        bscResult.verifiedOnChain ? 1 : 0,
        bscResult.summary,
        Date.now()
      );

    return NextResponse.json(
      {
        ok: true,
        donationId: Number(info.lastInsertRowid),
        bscVerification: bscResult,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Donation submit error:', err);
    return NextResponse.json({ error: 'Unable to submit donation.' }, { status: 500 });
  }
}
