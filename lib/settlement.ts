import { getDb, withTransaction } from './db';
import { DAY_MS, roundUsdt, type TeamStatsSummary } from './quant-rules';

export function settleDueSignals(nowMs = Date.now()): number {
  const db = getDb();
  const dueClaims = db
    .prepare(
      `SELECT sc.id, sc.signal_id, sc.user_id, sc.expected_profit, s.signal_code, s.profit_percent
       FROM signal_claims sc
       JOIN signals s ON s.id = sc.signal_id
       WHERE sc.status = 'PENDING' AND sc.settle_at <= ?`
    )
    .all(nowMs) as Array<{
    id: number;
    signal_id: number;
    user_id: number;
    expected_profit: number;
    signal_code: string;
    profit_percent: number;
  }>;

  if (dueClaims.length === 0) return 0;

  let settledCount = 0;
  withTransaction((tx) => {
    for (const claim of dueClaims) {
      const currentClaim = tx
        .prepare("SELECT status FROM signal_claims WHERE id = ?")
        .get(claim.id) as { status: string } | undefined;
      if (!currentClaim || currentClaim.status !== 'PENDING') continue;

      const user = tx
        .prepare('SELECT profit_balance, total_earned FROM users WHERE id = ?')
        .get(claim.user_id) as { profit_balance: number; total_earned: number } | undefined;
      if (!user) continue;

      const beforeProfit = roundUsdt(user.profit_balance);
      const afterProfit = roundUsdt(beforeProfit + claim.expected_profit);
      const afterEarned = roundUsdt(user.total_earned + claim.expected_profit);

      tx.prepare(
        'UPDATE users SET profit_balance = ?, total_earned = ? WHERE id = ?'
      ).run(afterProfit, afterEarned, claim.user_id);

      tx.prepare(
        "UPDATE signal_claims SET status = 'SETTLED', settled_at = ? WHERE id = ?"
      ).run(nowMs, claim.id);

      tx.prepare(
        `INSERT INTO ledger_transactions
         (user_id, type, wallet_target, amount, balance_before, balance_after, reference_id, note, created_at)
         VALUES (?, 'SIGNAL_PROFIT', 'PROFIT', ?, ?, ?, ?, ?, ?)`
      ).run(
        claim.user_id,
        claim.expected_profit,
        beforeProfit,
        afterProfit,
        `SIG-${claim.signal_id}`,
        `Settled ${claim.signal_code} (${claim.profit_percent}%)`,
        nowMs
      );

      settledCount += 1;
    }
  });

  return settledCount;
}

export interface TeamMemberNode {
  id: number;
  uid: string;
  username: string;
  fullName: string;
  grade: 'A' | 'B' | 'C';
  capitalBalance: number;
  totalDeposited: number;
  isActive: boolean;
  joinedAt: number;
  firstDepositAt: number | null;
}

export function getTeamTreeForUser(userId: number): {
  stats: TeamStatsSummary;
  inactiveCount: number;
  members: TeamMemberNode[];
  hasNewActiveDirectReferralWithin3Days: boolean;
} {
  const db = getDb();
  const now = Date.now();

  const gradeARows = db
    .prepare(
      `SELECT id, uid, username, full_name, capital_balance, total_deposited, first_deposit_at, created_at
       FROM users WHERE referred_by_id = ?`
    )
    .all(userId) as Array<{
    id: number;
    uid: string;
    username: string;
    full_name: string;
    capital_balance: number;
    total_deposited: number;
    first_deposit_at: number | null;
    created_at: number;
  }>;

  const members: TeamMemberNode[] = [];
  const gradeAIds: number[] = [];

  let gradeAActive = 0;
  let gradeBActive = 0;
  let gradeCActive = 0;
  let totalTeamActiveDeposit = 0;
  let inactiveCount = 0;
  let hasNewActiveDirectReferralWithin3Days = false;

  for (const r of gradeARows) {
    const isActive = r.capital_balance >= 100 && r.first_deposit_at !== null;
    if (isActive) {
      gradeAActive += 1;
      totalTeamActiveDeposit = roundUsdt(totalTeamActiveDeposit + r.capital_balance);
      if (r.first_deposit_at && now - r.first_deposit_at <= 3 * DAY_MS) {
        hasNewActiveDirectReferralWithin3Days = true;
      }
    } else {
      inactiveCount += 1;
    }
    gradeAIds.push(r.id);
    members.push({
      id: r.id,
      uid: r.uid,
      username: r.username,
      fullName: r.full_name,
      grade: 'A',
      capitalBalance: r.capital_balance,
      totalDeposited: r.total_deposited,
      isActive,
      joinedAt: r.created_at,
      firstDepositAt: r.first_deposit_at,
    });
  }

  const gradeBIds: number[] = [];
  if (gradeAIds.length > 0) {
    const placeholdersA = gradeAIds.map(() => '?').join(',');
    const gradeBRows = db
      .prepare(
        `SELECT id, uid, username, full_name, capital_balance, total_deposited, first_deposit_at, created_at
         FROM users WHERE referred_by_id IN (${placeholdersA})`
      )
      .all(...gradeAIds) as typeof gradeARows;

    for (const r of gradeBRows) {
      const isActive = r.capital_balance >= 100 && r.first_deposit_at !== null;
      if (isActive) {
        gradeBActive += 1;
        totalTeamActiveDeposit = roundUsdt(totalTeamActiveDeposit + r.capital_balance);
      } else {
        inactiveCount += 1;
      }
      gradeBIds.push(r.id);
      members.push({
        id: r.id,
        uid: r.uid,
        username: r.username,
        fullName: r.full_name,
        grade: 'B',
        capitalBalance: r.capital_balance,
        totalDeposited: r.total_deposited,
        isActive,
        joinedAt: r.created_at,
        firstDepositAt: r.first_deposit_at,
      });
    }
  }

  if (gradeBIds.length > 0) {
    const placeholdersB = gradeBIds.map(() => '?').join(',');
    const gradeCRows = db
      .prepare(
        `SELECT id, uid, username, full_name, capital_balance, total_deposited, first_deposit_at, created_at
         FROM users WHERE referred_by_id IN (${placeholdersB})`
      )
      .all(...gradeBIds) as typeof gradeARows;

    for (const r of gradeCRows) {
      const isActive = r.capital_balance >= 100 && r.first_deposit_at !== null;
      if (isActive) {
        gradeCActive += 1;
        totalTeamActiveDeposit = roundUsdt(totalTeamActiveDeposit + r.capital_balance);
      } else {
        inactiveCount += 1;
      }
      members.push({
        id: r.id,
        uid: r.uid,
        username: r.username,
        fullName: r.full_name,
        grade: 'C',
        capitalBalance: r.capital_balance,
        totalDeposited: r.total_deposited,
        isActive,
        joinedAt: r.created_at,
        firstDepositAt: r.first_deposit_at,
      });
    }
  }

  return {
    stats: {
      gradeAActive,
      gradeBActive,
      gradeCActive,
      totalTeamActive: gradeAActive + gradeBActive + gradeCActive,
      totalTeamActiveDeposit,
    },
    inactiveCount,
    members,
    hasNewActiveDirectReferralWithin3Days,
  };
}

export function getStartOfTodayUtcMs(nowMs = Date.now()): number {
  const d = new Date(nowMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getIsoWeekKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
