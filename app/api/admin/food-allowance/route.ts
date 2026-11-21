import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { validateTxHash } from '@/lib/quant-rules';

const paySchema = z.object({
  id: z.number().int().positive(),
  txHash: z.string().trim(),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const items = getDb()
    .prepare(
      `SELECT fa.*, u.uid, u.username, u.full_name, u.bep20_address as current_user_bep20
       FROM food_allowances fa
       JOIN users u ON u.id = fa.user_id
       ORDER BY CASE WHEN fa.status = 'PENDING' THEN 0 ELSE 1 END, fa.created_at DESC`
    )
    .all();

  const res = NextResponse.json({ items });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success || !validateTxHash(parsed.data.txHash)) {
    return NextResponse.json(
      { error: 'Provide a valid BEP20 payout TXID (0x + 64 hex chars).' },
      { status: 400 }
    );
  }

  const db = getDb();
  const item = db
    .prepare('SELECT id, user_id, allowance_amount, status FROM food_allowances WHERE id = ?')
    .get(parsed.data.id) as
    | { id: number; user_id: number; allowance_amount: number; status: string }
    | undefined;
  if (!item) {
    return NextResponse.json({ error: 'Food allowance record not found.' }, { status: 404 });
  }
  if (item.status === 'PAID') {
    return NextResponse.json({ error: 'Already marked as paid.' }, { status: 400 });
  }

  db.prepare(
    "UPDATE food_allowances SET status = 'PAID', payout_tx_hash = ?, paid_by = ?, paid_at = ? WHERE id = ?"
  ).run(parsed.data.txHash.trim(), guard.admin.displayName, Date.now(), item.id);

  logAdminAudit({
    admin: guard.admin,
    action: 'PAY_FOOD_ALLOWANCE',
    targetType: 'FOOD_ALLOWANCE',
    targetId: item.id,
    details: { amount: item.allowance_amount, txHash: parsed.data.txHash.trim() },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}
