export const DEPOSIT_TIERS = [100, 200, 300, 500, 1000, 2000, 3000, 5000] as const;

export const DEFAULT_REGULAR_SCHEDULE = ['16:00', '18:00', '20:00'] as const;
export const DEFAULT_EXTRA_SIGNAL_TIME = '21:00';
export const MIN_DONATION_USDT = 1;

export const DAY_MS = 24 * 60 * 60 * 1000;

export function roundUsdt(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function validateDonationAmount(amount: number): { valid: boolean; reason?: string } {
  if (!Number.isFinite(amount) || amount < MIN_DONATION_USDT) {
    return {
      valid: false,
      reason: `Minimum donation is $${MIN_DONATION_USDT} USDT (BEP20).`,
    };
  }
  if (amount > 1_000_000) {
    return {
      valid: false,
      reason: 'Single donation cannot exceed $1,000,000 USDT.',
    };
  }
  return { valid: true };
}

export function formatUsdt(value: number, decimals = 2): string {
  return roundUsdt(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function validateBep20Address(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export function validateTxHash(txHash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(txHash.trim());
}

export function validateUsername(username: string): { valid: boolean; reason?: string } {
  const trimmed = username.trim();
  if (trimmed.length < 4 || trimmed.length > 24) {
    return { valid: false, reason: 'Username must be 4–24 characters.' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { valid: false, reason: 'Username may only contain letters, numbers, and underscores.' };
  }
  if (trimmed.startsWith('#')) {
    return { valid: false, reason: 'Invalid username format.' };
  }
  return { valid: true };
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validateStrongPassword(password: string): {
  valid: boolean;
  score: number;
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
  reason?: string;
} {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  if (!checks.minLength) {
    return { valid: false, score, checks, reason: 'Password must be at least 8 characters.' };
  }
  if (!checks.hasUpper || !checks.hasLower || !checks.hasNumber || !checks.hasSpecial) {
    return {
      valid: false,
      score,
      checks,
      reason: 'Password must include uppercase, lowercase, number, and special character.',
    };
  }
  return { valid: true, score, checks };
}

export function calculateSignalProfit(
  capitalBalance: number,
  profitBalance: number,
  profitPercent: number
): {
  totalBase: number;
  expectedProfit: number;
} {
  const safeCapital = Math.max(0, capitalBalance);
  const safeProfit = Math.max(0, profitBalance);
  const totalBase = roundUsdt(safeCapital + safeProfit);
  const expectedProfit = roundUsdt(totalBase * (profitPercent / 100));
  return { totalBase, expectedProfit };
}

export function calculateDepositBonuses(params: {
  amount: number;
  isFirstDeposit: boolean;
  firstDepositBonusPct: number;
  directReferralBonusPct: number;
  foodAllowancePct: number;
  foodAllowanceMin: number;
}): {
  userFirstDepositBonus: number;
  sponsorReferralBonus: number;
  foodAllowanceAmount: number;
  qualifiesForFoodAllowance: boolean;
} {
  const {
    amount,
    isFirstDeposit,
    firstDepositBonusPct,
    directReferralBonusPct,
    foodAllowancePct,
    foodAllowanceMin,
  } = params;

  const userFirstDepositBonus = isFirstDeposit
    ? roundUsdt(amount * (firstDepositBonusPct / 100))
    : 0;
  const sponsorReferralBonus = roundUsdt(amount * (directReferralBonusPct / 100));
  const qualifiesForFoodAllowance = amount >= foodAllowanceMin;
  const foodAllowanceAmount = qualifiesForFoodAllowance
    ? roundUsdt(amount * (foodAllowancePct / 100))
    : 0;

  return {
    userFirstDepositBonus,
    sponsorReferralBonus,
    foodAllowanceAmount,
    qualifiesForFoodAllowance,
  };
}

export function getWithdrawLockStatus(
  firstDepositAtMs: number | null,
  lockDays: number,
  nowMs = Date.now()
): {
  hasActiveDeposit: boolean;
  unlocked: boolean;
  unlocksAtMs: number | null;
  remainingMs: number;
  daysElapsed: number;
} {
  if (!firstDepositAtMs) {
    return {
      hasActiveDeposit: false,
      unlocked: false,
      unlocksAtMs: null,
      remainingMs: lockDays * DAY_MS,
      daysElapsed: 0,
    };
  }
  const unlocksAtMs = firstDepositAtMs + lockDays * DAY_MS;
  const remainingMs = Math.max(0, unlocksAtMs - nowMs);
  const daysElapsed = Math.floor(Math.max(0, nowMs - firstDepositAtMs) / DAY_MS);
  return {
    hasActiveDeposit: true,
    unlocked: remainingMs === 0,
    unlocksAtMs,
    remainingMs,
    daysElapsed,
  };
}

export function calculateWithdrawBreakdown(params: {
  requestedAmount: number;
  profitBalance: number;
  feePercent: number;
  minWithdraw: number;
  unlocked: boolean;
  todayWithdrawCount: number;
  hasWalletBound: boolean;
}): {
  valid: boolean;
  feeAmount: number;
  netAmount: number;
  reason?: string;
} {
  const {
    requestedAmount,
    profitBalance,
    feePercent,
    minWithdraw,
    unlocked,
    todayWithdrawCount,
    hasWalletBound,
  } = params;

  if (!hasWalletBound) {
    return { valid: false, feeAmount: 0, netAmount: 0, reason: 'Bind your BEP20 wallet address first.' };
  }
  if (!unlocked) {
    return {
      valid: false,
      feeAmount: 0,
      netAmount: 0,
      reason: 'Withdrawals unlock 15 days after your first approved deposit.',
    };
  }
  if (todayWithdrawCount >= 1) {
    return {
      valid: false,
      feeAmount: 0,
      netAmount: 0,
      reason: 'Daily limit reached. Only 1 withdrawal is permitted per day.',
    };
  }
  if (!Number.isFinite(requestedAmount) || requestedAmount < minWithdraw) {
    return {
      valid: false,
      feeAmount: 0,
      netAmount: 0,
      reason: `Minimum withdrawal amount is $${minWithdraw} USDT.`,
    };
  }
  if (requestedAmount > profitBalance) {
    return {
      valid: false,
      feeAmount: 0,
      netAmount: 0,
      reason: 'Insufficient Profit Balance. Trading Capital cannot be withdrawn.',
    };
  }
  const feeAmount = roundUsdt(requestedAmount * (feePercent / 100));
  const netAmount = roundUsdt(requestedAmount - feeAmount);
  if (netAmount <= 0) {
    return { valid: false, feeAmount: 0, netAmount: 0, reason: 'Net payout must be positive.' };
  }
  return { valid: true, feeAmount, netAmount };
}

export function evaluateSignalEligibility(params: {
  capitalBalance: number;
  firstDepositAtMs: number | null;
  signalType: 'REGULAR' | 'ADDITIONAL';
  startsAtMs: number;
  expiresAtMs: number;
  alreadyClaimed: boolean;
  hasNewActiveDirectReferralWithin3Days: boolean;
  sponsorAdditionalClaimsToday: number;
  targetUserId?: number | null;
  currentUserId?: number;
  nowMs?: number;
}): {
  eligible: boolean;
  reason?: string;
} {
  const nowMs = params.nowMs ?? Date.now();
  if (params.capitalBalance < 100 || !params.firstDepositAtMs) {
    return {
      eligible: false,
      reason: 'Deposit at least $100 USDT to unlock signal execution.',
    };
  }
  if (params.alreadyClaimed) {
    return {
      eligible: false,
      reason: 'You have already executed this signal.',
    };
  }
  if (params.targetUserId != null && params.currentUserId !== params.targetUserId) {
    return {
      eligible: false,
      reason: 'This personal signal code is locked to a specific member account and cannot be shared.',
    };
  }
  if (nowMs < params.startsAtMs) {
    return {
      eligible: false,
      reason: 'This signal window has not opened yet.',
    };
  }
  if (nowMs > params.expiresAtMs) {
    return {
      eligible: false,
      reason: 'Signal code has expired.',
    };
  }

  if (params.signalType === 'ADDITIONAL') {
    const isNewUserWithin3Days = nowMs - params.firstDepositAtMs <= 3 * DAY_MS;
    if (isNewUserWithin3Days) {
      return { eligible: true };
    }
    if (params.hasNewActiveDirectReferralWithin3Days) {
      if (params.sponsorAdditionalClaimsToday >= 1) {
        return {
          eligible: false,
          reason: 'Sponsor daily limit reached (max 1 additional signal per day).',
        };
      }
      return { eligible: true };
    }
    return {
      eligible: false,
      reason:
        'Additional signals are restricted to newly deposited members (first 3 days) and their direct sponsor.',
    };
  }

  return { eligible: true };
}

export interface SalaryLevelRule {
  level: number;
  name: string;
  minDirectActive: number;
  minTeamActive: number;
  minOwnDeposit: number;
  calcMode: 'PERCENTAGE' | 'FIXED';
  rateValue: number;
  useTeamMatchedCap: boolean;
}

export interface TeamStatsSummary {
  gradeAActive: number;
  gradeBActive: number;
  gradeCActive: number;
  totalTeamActive: number;
  totalTeamActiveDeposit: number;
}

export function evaluateSalaryQualification(
  ownCapital: number,
  teamStats: TeamStatsSummary,
  levels: SalaryLevelRule[]
): {
  qualifiedLevel: SalaryLevelRule | null;
  baseAmount: number;
  payoutAmount: number;
} {
  if (ownCapital < 100 || levels.length === 0) {
    return { qualifiedLevel: null, baseAmount: 0, payoutAmount: 0 };
  }

  const sorted = [...levels].sort((a, b) => b.level - a.level);
  for (const rule of sorted) {
    const meetsDirect = teamStats.gradeAActive >= rule.minDirectActive;
    const meetsTeam = teamStats.totalTeamActive >= rule.minTeamActive;
    const meetsOwn = ownCapital >= rule.minOwnDeposit;
    if (meetsDirect && meetsTeam && meetsOwn) {
      if (rule.calcMode === 'FIXED') {
        return {
          qualifiedLevel: rule,
          baseAmount: roundUsdt(ownCapital),
          payoutAmount: roundUsdt(rule.rateValue),
        };
      }
      const baseAmount = rule.useTeamMatchedCap
        ? roundUsdt(Math.min(ownCapital, teamStats.totalTeamActiveDeposit))
        : roundUsdt(ownCapital);
      const payoutAmount = roundUsdt(baseAmount * (rule.rateValue / 100));
      return {
        qualifiedLevel: rule,
        baseAmount,
        payoutAmount,
      };
    }
  }

  return { qualifiedLevel: null, baseAmount: 0, payoutAmount: 0 };
}
