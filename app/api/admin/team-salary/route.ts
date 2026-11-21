import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { attachRefreshedAdminCookie, requireAdminGuard } from '@/lib/admin-guard';
import { getClientIp, logAdminAudit } from '@/lib/auth';
import { getDb, getSalaryLevels, withTransaction } from '@/lib/db';
import { evaluateSalaryQualification, roundUsdt } from '@/lib/quant-rules';
import { getIsoWeekKey, getTeamTreeForUser } from '@/lib/settlement';

const updateLevelsSchema = z.object({
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1).max(7),
        name: z.string().trim().min(2).max(50),
        minDirectActive: z.number().int().min(0),
        minTeamActive: z.number().int().min(0),
        minOwnDeposit: z.number().min(0),
        calcMode: z.enum(['PERCENTAGE', 'FIXED']),
        rateValue: z.number().min(0).max(100000),
        useTeamMatchedCap: z.boolean(),
      })
    )
    .min(1),
});

export async function GET() {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const db = getDb();
  const levels = getSalaryLevels();
  const currentWeek = getIsoWeekKey();

  const users = db
    .prepare(
      `SELECT id, uid, username, full_name, capital_balance, profit_balance, total_deposited, first_deposit_at, status
       FROM users WHERE status = 'ACTIVE' ORDER BY capital_balance DESC`
    )
    .all() as Array<{
    id: number;
    uid: string;
    username: string;
    full_name: string;
    capital_balance: number;
    profit_balance: number;
    total_deposited: number;
    first_deposit_at: number | null;
    status: string;
  }>;

  const paidThisWeekRows = db
    .prepare('SELECT user_id FROM salary_payouts WHERE week_key = ?')
    .all(currentWeek) as Array<{ user_id: number }>;
  const paidSet = new Set(paidThisWeekRows.map((r) => r.user_id));

  const leaders = users.map((u) => {
    const tree = getTeamTreeForUser(u.id);
    const qual = evaluateSalaryQualification(u.capital_balance, tree.stats, levels);
    return {
      userId: u.id,
      uid: u.uid,
      username: u.username,
      fullName: u.full_name,
      ownCapital: roundUsdt(u.capital_balance),
      gradeAActive: tree.stats.gradeAActive,
      gradeBActive: tree.stats.gradeBActive,
      gradeCActive: tree.stats.gradeCActive,
      totalTeamActive: tree.stats.totalTeamActive,
      inactiveTeamCount: tree.inactiveCount,
      totalTeamActiveDeposit: tree.stats.totalTeamActiveDeposit,
      qualifiedLevel: qual.qualifiedLevel?.level || 0,
      qualifiedLevelName: qual.qualifiedLevel?.name || 'Not Qualified',
      calcMode: qual.qualifiedLevel?.calcMode || 'PERCENTAGE',
      rateValue: qual.qualifiedLevel?.rateValue || 0,
      baseAmount: qual.baseAmount,
      estimatedSalary: qual.payoutAmount,
      paidThisWeek: paidSet.has(u.id),
    };
  });

  const payouts = db
    .prepare(
      `SELECT sp.*, u.uid, u.username, u.full_name
       FROM salary_payouts sp JOIN users u ON u.id = sp.user_id
       ORDER BY sp.paid_at DESC LIMIT 50`
    )
    .all();

  const res = NextResponse.json({
    currentWeek,
    levels,
    leaders,
    payouts,
  });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = await req.json();
  const parsed = updateLevelsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid salary configuration.' },
      { status: 400 }
    );
  }

  withTransaction((tx) => {
    const stmt = tx.prepare(
      `INSERT INTO salary_levels
       (level, name, min_direct_active, min_team_active, min_own_deposit, calc_mode, rate_value, use_team_matched_cap)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(level) DO UPDATE SET
         name = excluded.name,
         min_direct_active = excluded.min_direct_active,
         min_team_active = excluded.min_team_active,
         min_own_deposit = excluded.min_own_deposit,
         calc_mode = excluded.calc_mode,
         rate_value = excluded.rate_value,
         use_team_matched_cap = excluded.use_team_matched_cap`
    );

    for (const l of parsed.data.levels) {
      stmt.run(
        l.level,
        l.name,
        l.minDirectActive,
        l.minTeamActive,
        l.minOwnDeposit,
        l.calcMode,
        l.rateValue,
        l.useTeamMatchedCap ? 1 : 0
      );
    }
  });

  logAdminAudit({
    admin: guard.admin,
    action: 'UPDATE_SALARY_LEVELS',
    targetType: 'SALARY_CONFIG',
    targetId: 'LEVELS_1_7',
    details: { count: parsed.data.levels.length },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true });
  return attachRefreshedAdminCookie(res, guard.admin);
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminGuard();
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as { userId?: number };
  const levels = getSalaryLevels();
  const weekKey = getIsoWeekKey();
  const now = Date.now();
  const db = getDb();

  const targetUsers = body.userId
    ? (db
        .prepare("SELECT id, uid, username, capital_balance, profit_balance, total_earned FROM users WHERE id = ? AND status = 'ACTIVE'")
        .all(body.userId) as Array<{
        id: number;
        uid: string;
        username: string;
        capital_balance: number;
        profit_balance: number;
        total_earned: number;
      }>)
    : (db
        .prepare("SELECT id, uid, username, capital_balance, profit_balance, total_earned FROM users WHERE status = 'ACTIVE' AND capital_balance >= 100")
        .all() as Array<{
        id: number;
        uid: string;
        username: string;
        capital_balance: number;
        profit_balance: number;
        total_earned: number;
      }>);

  let paidCount = 0;
  let totalDisbursed = 0;

  withTransaction((tx) => {
    for (const u of targetUsers) {
      const already = tx
        .prepare('SELECT id FROM salary_payouts WHERE user_id = ? AND week_key = ?')
        .get(u.id, weekKey) as { id: number } | undefined;
      if (already) continue;

      const tree = getTeamTreeForUser(u.id);
      const qual = evaluateSalaryQualification(u.capital_balance, tree.stats, levels);
      if (!qual.qualifiedLevel || qual.payoutAmount <= 0) continue;

      const fresh = tx
        .prepare('SELECT profit_balance, total_earned FROM users WHERE id = ?')
        .get(u.id) as { profit_balance: number; total_earned: number };

      const beforeProfit = roundUsdt(fresh.profit_balance);
      const afterProfit = roundUsdt(beforeProfit + qual.payoutAmount);

      tx.prepare('UPDATE users SET profit_balance = ?, total_earned = ? WHERE id = ?').run(
        afterProfit,
        roundUsdt(fresh.total_earned + qual.payoutAmount),
        u.id
      );

      tx.prepare(
        `INSERT INTO salary_payouts
         (user_id, week_key, level_achieved, base_amount, calc_mode, rate_value, payout_amount, status, paid_by, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?)`
      ).run(
        u.id,
        weekKey,
        qual.qualifiedLevel.level,
        qual.baseAmount,
        qual.qualifiedLevel.calcMode,
        qual.qualifiedLevel.rateValue,
        qual.payoutAmount,
        guard.admin.displayName,
        now
      );

      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, 'SUNDAY_SALARY', 'PROFIT', ?, ?, ?, ?, ?, ?)`
      ).run(
        u.id,
        qual.payoutAmount,
        beforeProfit,
        afterProfit,
        `SAL-${weekKey}`,
        `Sunday Salary ${qual.qualifiedLevel.name} (${weekKey})`,
        now
      );

      paidCount += 1;
      totalDisbursed = roundUsdt(totalDisbursed + qual.payoutAmount);
    }
  });

  logAdminAudit({
    admin: guard.admin,
    action: 'PAY_SUNDAY_SALARY',
    targetType: 'SALARY',
    targetId: weekKey,
    details: { paidCount, totalDisbursed },
    ipAddress: await getClientIp(),
  });

  const res = NextResponse.json({ ok: true, weekKey, paidCount, totalDisbursed });
  return attachRefreshedAdminCookie(res, guard.admin);
}
