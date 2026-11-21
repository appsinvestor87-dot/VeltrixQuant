import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_MS,
  calculateDepositBonuses,
  calculateSignalProfit,
  calculateWithdrawBreakdown,
  evaluateSalaryQualification,
  evaluateSignalEligibility,
  getWithdrawLockStatus,
  validateBep20Address,
  validateDonationAmount,
  validateStrongPassword,
  validateTxHash,
  validateUsername,
  type SalaryLevelRule,
} from './quant-rules';

test('compounding signal profit calculates on (capital + profit)', () => {
  const res = calculateSignalProfit(1000, 125, 0.8);
  assert.equal(res.totalBase, 1125);
  assert.equal(res.expectedProfit, 9);
});

test('deposit bonuses apply 5% first deposit, 7% sponsor, and 10% food allowance at >= $300', () => {
  const first300 = calculateDepositBonuses({
    amount: 300,
    isFirstDeposit: true,
    firstDepositBonusPct: 5,
    directReferralBonusPct: 7,
    foodAllowancePct: 10,
    foodAllowanceMin: 300,
  });
  assert.equal(first300.userFirstDepositBonus, 15);
  assert.equal(first300.sponsorReferralBonus, 21);
  assert.equal(first300.qualifiesForFoodAllowance, true);
  assert.equal(first300.foodAllowanceAmount, 30);

  const second200 = calculateDepositBonuses({
    amount: 200,
    isFirstDeposit: false,
    firstDepositBonusPct: 5,
    directReferralBonusPct: 7,
    foodAllowancePct: 10,
    foodAllowanceMin: 300,
  });
  assert.equal(second200.userFirstDepositBonus, 0);
  assert.equal(second200.sponsorReferralBonus, 14);
  assert.equal(second200.qualifiesForFoodAllowance, false);
  assert.equal(second200.foodAllowanceAmount, 0);
});

test('15-day withdrawal lock and daily 1-withdraw limit enforce capital safety', () => {
  const now = 1_700_000_000_000;
  const locked = getWithdrawLockStatus(now - 10 * DAY_MS, 15, now);
  assert.equal(locked.unlocked, false);

  const unlocked = getWithdrawLockStatus(now - 15 * DAY_MS, 15, now);
  assert.equal(unlocked.unlocked, true);

  const blockedCap = calculateWithdrawBreakdown({
    requestedAmount: 50,
    profitBalance: 30,
    feePercent: 3,
    minWithdraw: 10,
    unlocked: true,
    todayWithdrawCount: 0,
    hasWalletBound: true,
  });
  assert.equal(blockedCap.valid, false);

  const dailyBlocked = calculateWithdrawBreakdown({
    requestedAmount: 20,
    profitBalance: 100,
    feePercent: 3,
    minWithdraw: 10,
    unlocked: true,
    todayWithdrawCount: 1,
    hasWalletBound: true,
  });
  assert.equal(dailyBlocked.valid, false);

  const ok = calculateWithdrawBreakdown({
    requestedAmount: 100,
    profitBalance: 150,
    feePercent: 3,
    minWithdraw: 10,
    unlocked: true,
    todayWithdrawCount: 0,
    hasWalletBound: true,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.feeAmount, 3);
  assert.equal(ok.netAmount, 97);
});

test('signal eligibility blocks $0 accounts and restricts ADDITIONAL signals to 3-day new users or sponsor 1/day', () => {
  const now = 1_700_000_000_000;
  const noDeposit = evaluateSignalEligibility({
    capitalBalance: 0,
    firstDepositAtMs: null,
    signalType: 'REGULAR',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: false,
    sponsorAdditionalClaimsToday: 0,
    nowMs: now,
  });
  assert.equal(noDeposit.eligible, false);

  const newUserAdditional = evaluateSignalEligibility({
    capitalBalance: 100,
    firstDepositAtMs: now - 2 * DAY_MS,
    signalType: 'ADDITIONAL',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: false,
    sponsorAdditionalClaimsToday: 0,
    nowMs: now,
  });
  assert.equal(newUserAdditional.eligible, true);

  const veteranNoReferral = evaluateSignalEligibility({
    capitalBalance: 500,
    firstDepositAtMs: now - 20 * DAY_MS,
    signalType: 'ADDITIONAL',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: false,
    sponsorAdditionalClaimsToday: 0,
    nowMs: now,
  });
  assert.equal(veteranNoReferral.eligible, false);

  const sponsorSecondSameDay = evaluateSignalEligibility({
    capitalBalance: 500,
    firstDepositAtMs: now - 20 * DAY_MS,
    signalType: 'ADDITIONAL',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: true,
    sponsorAdditionalClaimsToday: 1,
    nowMs: now,
  });
  assert.equal(sponsorSecondSameDay.eligible, false);

  const lockedWrongUser = evaluateSignalEligibility({
    capitalBalance: 500,
    firstDepositAtMs: now - 2 * DAY_MS,
    signalType: 'ADDITIONAL',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: false,
    sponsorAdditionalClaimsToday: 0,
    targetUserId: 42,
    currentUserId: 99,
    nowMs: now,
  });
  assert.equal(lockedWrongUser.eligible, false);

  const lockedRightUser = evaluateSignalEligibility({
    capitalBalance: 500,
    firstDepositAtMs: now - 2 * DAY_MS,
    signalType: 'ADDITIONAL',
    startsAtMs: now - 60_000,
    expiresAtMs: now + 60_000,
    alreadyClaimed: false,
    hasNewActiveDirectReferralWithin3Days: false,
    sponsorAdditionalClaimsToday: 0,
    targetUserId: 42,
    currentUserId: 42,
    nowMs: now,
  });
  assert.equal(lockedRightUser.eligible, true);
});

test('salary qualification supports team-matched cap and fixed mode', () => {
  const levels: SalaryLevelRule[] = [
    {
      level: 1,
      name: 'Tier 1',
      minDirectActive: 5,
      minTeamActive: 5,
      minOwnDeposit: 100,
      calcMode: 'PERCENTAGE',
      rateValue: 1.0,
      useTeamMatchedCap: true,
    },
    {
      level: 2,
      name: 'Tier 2',
      minDirectActive: 8,
      minTeamActive: 20,
      minOwnDeposit: 100,
      calcMode: 'FIXED',
      rateValue: 35,
      useTeamMatchedCap: true,
    },
  ];

  // Loophole case: own $5000, team $500 -> capped at $500 -> 1% = $5
  const capped = evaluateSalaryQualification(
    5000,
    { gradeAActive: 5, gradeBActive: 0, gradeCActive: 0, totalTeamActive: 5, totalTeamActiveDeposit: 500 },
    levels
  );
  assert.equal(capped.qualifiedLevel?.level, 1);
  assert.equal(capped.baseAmount, 500);
  assert.equal(capped.payoutAmount, 5);

  // Level 2 fixed payout
  const fixedRes = evaluateSalaryQualification(
    500,
    { gradeAActive: 9, gradeBActive: 8, gradeCActive: 5, totalTeamActive: 22, totalTeamActiveDeposit: 3000 },
    levels
  );
  assert.equal(fixedRes.qualifiedLevel?.level, 2);
  assert.equal(fixedRes.payoutAmount, 35);
});

test('validators check BEP20, TXID, username, and strong password', () => {
  assert.equal(validateBep20Address('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'), true);
  assert.equal(validateBep20Address('TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE'), false);
  assert.equal(validateTxHash('0x' + 'a'.repeat(64)), true);
  assert.equal(validateUsername('ali_trader99').valid, true);
  assert.equal(validateUsername('#admin4466').valid, false);
  assert.equal(validateStrongPassword('weak').valid, false);
  assert.equal(validateStrongPassword('Veltrix@2026').valid, true);
});

test('donation validator enforces $1 USDT minimum and rejects invalid amounts', () => {
  assert.equal(validateDonationAmount(0).valid, false);
  assert.equal(validateDonationAmount(0.99).valid, false);
  assert.equal(validateDonationAmount(-5).valid, false);
  assert.equal(validateDonationAmount(Number.NaN).valid, false);
  assert.equal(validateDonationAmount(1).valid, true);
  assert.equal(validateDonationAmount(25.5).valid, true);
  assert.equal(validateDonationAmount(1_000_001).valid, false);
});
