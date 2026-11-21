import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { verifyBep20UsdtTx } from '@/lib/bscscan';
import { ensureDonationAccountQr, getDb } from '@/lib/db';
import { roundUsdt, validateBep20Address } from '@/lib/quant-rules';

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('SET_ACCOUNT'),
    label: z.string().trim().min(2, 'Wallet label is required').max(60),
    address: z.string().trim(),
    customQrDataUrl: z.string().max(400_000).optional(),
    deactivateOthers: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('TOGGLE_ACCOUNT'),
    accountId: z.number().int().positive(),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal('VERIFY_BSCSCAN'),
    donationId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal('APPROVE'),
    donationId: z.number().int().positive(),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({
    action: z.literal('REJECT'),
    donationId: z.number().int().positive(),
    note: z.string().trim().min(3, 'Rejection reason is required').max(200),
  }),
]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const statusFilter = (req.nextUrl.searchParams.get('status') || 'ALL').toUpperCase();
  const db = getDb();

  const accounts = db
    .prepare('SELECT * FROM donation_accounts ORDER BY id DESC')
    .all() as Array<{
    id: number;
    label: string;
    network: string;
    address: string;
    qr_data_url: string | null;
    is_active: number;
    created_at: number;
  }>;

  for (const acc of accounts) {
    if (!acc.qr_data_url) {
      acc.qr_data_url = await ensureDonationAccountQr(acc.id, acc.address);
    }
  }

  const baseQuery = `
    SELECT dn.*, u.uid, u.username, u.full_name, u.email,
           da.label as account_label, da.address as receiving_address
    FROM donations dn
    JOIN users u ON u.id = dn.user_id
    LEFT JOIN donation_accounts da ON da.id = dn.donation_account_id
  `;

  const donations =
    statusFilter === 'ALL'
      ? db.prepare(`${baseQuery} ORDER BY dn.created_at DESC LIMIT 200`).all()
      : db
          .prepare(`${baseQuery} WHERE dn.status = ? ORDER BY dn.created_at DESC LIMIT 200`)
          .all(statusFilter);

  const summary = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as totalApprovedAmount,
              SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) as approvedCount,
              SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingCount,
              SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) as rejectedCount,
              COUNT(DISTINCT CASE WHEN status = 'APPROVED' THEN user_id END) as uniqueDonors
       FROM donations`
    )
    .get() as {
    totalApprovedAmount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    uniqueDonors: number;
  };

  const res = NextResponse.json({
    accounts,
    donations,
    summary: {
      totalApprovedAmount: roundUsdt(summary.totalApprovedAmount || 0),
      approvedCount: summary.approvedCount || 0,
      pendingCount: summary.pendingCount || 0,
      rejectedCount: summary.rejectedCount || 0,
      uniqueDonors: summary.uniqueDonors || 0,
    },
  });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid donation action.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const ip = await getClientIp();
    const now = Date.now();
    const data = parsed.data;

    if (data.action === 'SET_ACCOUNT') {
      if (guard.admin.role !== 'MASTER_ADMIN') {
        return NextResponse.json(
          { error: 'Only Master Admin can configure donation receiving wallets.' },
          { status: 403 }
        );
      }
      if (!validateBep20Address(data.address)) {
        return NextResponse.json(
          { error: 'Invalid BEP20 address (must start with 0x followed by 40 hex chars).' },
          { status: 400 }
        );
      }

      const qrDataUrl =
        data.customQrDataUrl && data.customQrDataUrl.startsWith('data:image/')
          ? data.customQrDataUrl
          : await QRCode.toDataURL(data.address.trim(), {
              width: 240,
              margin: 2,
              color: { dark: '#0B1117', light: '#FFFFFF' },
            });

      if (data.deactivateOthers !== false) {
        db.prepare('UPDATE donation_accounts SET is_active = 0').run();
      }

      const info = db
        .prepare(
          `INSERT INTO donation_accounts (label, network, address, qr_data_url, is_active, created_at)
           VALUES (?, 'USDT-BEP20', ?, ?, 1, ?)`
        )
        .run(data.label, data.address.trim(), qrDataUrl, now);

      logAdminAudit({
        admin: guard.admin,
        action: 'SET_DONATION_ACCOUNT',
        targetType: 'DONATION_ACCOUNT',
        targetId: Number(info.lastInsertRowid),
        details: { label: data.label, address: data.address.trim() },
        ipAddress: ip,
      });

      const res = NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) }, { status: 201 });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    if (data.action === 'TOGGLE_ACCOUNT') {
      if (guard.admin.role !== 'MASTER_ADMIN') {
        return NextResponse.json(
          { error: 'Only Master Admin can toggle donation wallets.' },
          { status: 403 }
        );
      }
      db.prepare('UPDATE donation_accounts SET is_active = ? WHERE id = ?').run(
        data.isActive ? 1 : 0,
        data.accountId
      );
      logAdminAudit({
        admin: guard.admin,
        action: 'TOGGLE_DONATION_ACCOUNT',
        targetType: 'DONATION_ACCOUNT',
        targetId: data.accountId,
        details: { isActive: data.isActive },
        ipAddress: ip,
      });
      const res = NextResponse.json({ ok: true });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    if (data.action === 'VERIFY_BSCSCAN') {
      const dn = db
        .prepare(
          `SELECT dn.id, dn.amount, dn.tx_hash, da.address as receiving_address
           FROM donations dn
           LEFT JOIN donation_accounts da ON da.id = dn.donation_account_id
           WHERE dn.id = ?`
        )
        .get(data.donationId) as
        | { id: number; amount: number; tx_hash: string; receiving_address: string | null }
        | undefined;
      if (!dn) {
        return NextResponse.json({ error: 'Donation record not found.' }, { status: 404 });
      }
      const bsc = await verifyBep20UsdtTx({
        txHash: dn.tx_hash,
        expectedRecipient: dn.receiving_address || '',
        expectedAmount: dn.amount,
      });
      db.prepare('UPDATE donations SET bsc_verified = ?, bsc_details = ? WHERE id = ?').run(
        bsc.verifiedOnChain ? 1 : 0,
        bsc.summary,
        data.donationId
      );
      const res = NextResponse.json({ ok: true, bscVerification: bsc });
      return attachRefreshedAdminCookie(res, guard.admin);
    }

    const dn = db
      .prepare('SELECT id, user_id, amount, status FROM donations WHERE id = ?')
      .get(data.donationId) as
      | { id: number; user_id: number; amount: number; status: string }
      | undefined;
    if (!dn) {
      return NextResponse.json({ error: 'Donation record not found.' }, { status: 404 });
    }
    if (dn.status !== 'PENDING') {
      return NextResponse.json({ error: 'Donation has already been reviewed.' }, { status: 400 });
    }

    if (data.action === 'APPROVE') {
      const note = data.note || 'Approved by Admin';
      db.prepare(
        "UPDATE donations SET status = 'APPROVED', reviewed_by = ?, review_note = ?, reviewed_at = ? WHERE id = ?"
      ).run(guard.admin.displayName, note, now, dn.id);

      logAdminAudit({
        admin: guard.admin,
        action: 'APPROVE_DONATION',
        targetType: 'DONATION',
        targetId: dn.id,
        details: { userId: dn.user_id, amount: dn.amount, note },
        ipAddress: ip,
      });
    } else {
      db.prepare(
        "UPDATE donations SET status = 'REJECTED', reviewed_by = ?, review_note = ?, reviewed_at = ? WHERE id = ?"
      ).run(guard.admin.displayName, data.note, now, dn.id);

      logAdminAudit({
        admin: guard.admin,
        action: 'REJECT_DONATION',
        targetType: 'DONATION',
        targetId: dn.id,
        details: { userId: dn.user_id, amount: dn.amount, reason: data.note },
        ipAddress: ip,
      });
    }

    const res = NextResponse.json({ ok: true });
    return attachRefreshedAdminCookie(res, guard.admin);
  } catch (err) {
    console.error('Admin donation error:', err);
    return NextResponse.json({ error: 'Unable to process donation action.' }, { status: 500 });
  }
}
