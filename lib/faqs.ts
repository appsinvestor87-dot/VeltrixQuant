export type FaqCategory = 'ALL' | 'DEPOSITS' | 'SIGNALS' | 'WITHDRAWALS' | 'TEAM_SALARY' | 'SECURITY';

export interface FaqRuleContext {
  withdrawFeePercent: number;
  minWithdrawUsdt: number;
  withdrawLockDays: number;
  signalProfitPercent: number;
  signalValidityMinutes: number;
  signalSettleMinutes: number;
  regularSchedule: string;
  extraSignalTime: string;
  firstDepositBonusPct: number;
  directReferralBonusPct: number;
  foodAllowancePct: number;
  foodAllowanceMin: number;
}

export interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, 'ALL'>;
  question: string;
  answer: string;
}

export interface FixedChatbotQuestion {
  id: string;
  label: string;
  question: string;
  expectedTopic: string;
}

export const DEFAULT_FAQ_RULES: FaqRuleContext = {
  withdrawFeePercent: 3,
  minWithdrawUsdt: 10,
  withdrawLockDays: 15,
  signalProfitPercent: 0.8,
  signalValidityMinutes: 30,
  signalSettleMinutes: 20,
  regularSchedule: '4:00 PM, 6:00 PM, 8:00 PM',
  extraSignalTime: '9:00 PM',
  firstDepositBonusPct: 5,
  directReferralBonusPct: 7,
  foodAllowancePct: 10,
  foodAllowanceMin: 300,
};

export function getPlatformFaqs(r: FaqRuleContext = DEFAULT_FAQ_RULES): FaqItem[] {
  return [
    {
      id: 'faq-invite-signup',
      category: 'SECURITY',
      question: 'How does invite-only registration work?',
      answer:
        'New members must enter a valid referral code from an already-deposited ($100+ active) sponsor. Your full name, unique username, and email lock permanently upon signup. Your own shareable referral code unlocks automatically as soon as your first deposit is approved.',
    },
    {
      id: 'faq-deposit-tiers',
      category: 'DEPOSITS',
      question: 'Which USDT network and deposit tiers are accepted?',
      answer: `Only USDT on BNB Smart Chain (BEP20) is accepted across fixed tiers: $100, $200, $300, $500, $1,000, $2,000, $3,000, and $5,000. After transferring to an active Company Wallet, submit your exact BscScan TXID for verification. Your first approved deposit grants an extra +${r.firstDepositBonusPct}% bonus into Profit Balance.`,
    },
    {
      id: 'faq-food-allowance',
      category: 'DEPOSITS',
      question: `How do I qualify for the ${r.foodAllowancePct}% Food Allowance?`,
      answer: `Any approved deposit of $${r.foodAllowanceMin} USDT or higher ($300, $500, $1,000, $2,000, $3,000, $5,000) qualifies for a ${r.foodAllowancePct}% Food Allowance. Unlike trading profit, Food Allowance is paid externally straight to your bound BEP20 payout wallet after Admin approval.`,
    },
    {
      id: 'faq-signal-schedule',
      category: 'SIGNALS',
      question: 'When do daily trading signals arrive and how is profit calculated?',
      answer: `Three regular signals run daily (${r.regularSchedule}). Once a deposit ($100+) is approved, each signal remains active for ${r.signalValidityMinutes} minutes, pays ${r.signalProfitPercent}% compounding on (Trading Capital + Profit Balance), and credits profit after ${r.signalSettleMinutes} minutes.`,
    },
    {
      id: 'faq-extra-signal',
      category: 'SIGNALS',
      question: 'Who receives the additional 9:00 PM signal?',
      answer: `The additional signal (${r.extraSignalTime}) is exclusively unlocked for newly deposited members during their first 3 days AND for their direct sponsor when that new Grade A member activates a deposit (capped at 1 additional claim per sponsor per day).`,
    },
    {
      id: 'faq-withdraw-rules',
      category: 'WITHDRAWALS',
      question: 'When can I withdraw, and can Trading Capital be withdrawn?',
      answer: `Deposited Trading Capital remains locked for signal compounding and cannot be withdrawn. Profit Balance unlocks permanently ${r.withdrawLockDays} days after your first approved deposit—after which withdrawals run 24/7 (1 request per day, minimum $${r.minWithdrawUsdt} USDT, ${r.withdrawFeePercent}% fee).`,
    },
    {
      id: 'faq-wallet-pin',
      category: 'WITHDRAWALS',
      question: 'How does one-time BEP20 wallet binding protect my payouts?',
      answer:
        'Inside Wallet -> Withdraw, you bind your personal BEP20 USDT address together with a Withdraw PIN once. For security against account takeover, that payout address locks permanently and can only be changed via direct Master Admin identity verification.',
    },
    {
      id: 'faq-referral-grades',
      category: 'TEAM_SALARY',
      question: 'How do Grade A, B, and C team bonuses work?',
      answer: `Direct referrals (Grade A) earn you an instant +${r.directReferralBonusPct}% of every approved deposit they make into your Profit Balance. Grade B and Grade C active deposited members ($100+) do not pay direct deposit commissions, but they count directly toward your Sunday Leadership Salary rank.`,
    },
    {
      id: 'faq-sunday-salary',
      category: 'TEAM_SALARY',
      question: 'What are the Sunday Salary levels (L1–L7) and Team-Matched Cap?',
      answer:
        'Sunday Salaries process weekly across 7 levels (default Fixed $10, $25, $50, $100, $150, $300, and $500) based on active ($100+) Grade A members, total Grade A+B+C team size, and minimum own capital. When percentage mode is active, Team-Matched Cap limits calculation to min(Own Capital, Active Team Deposit) so inactive ($0) accounts cannot inflate ranks.',
    },
    {
      id: 'faq-donations',
      category: 'DEPOSITS',
      question: 'How do voluntary $1+ BEP20 community donations work?',
      answer:
        'Members can contribute $1 USDT (BEP20) or more from Wallet -> Donate using the official Admin-configured donation wallet or QR code and submitting the BscScan TXID. Donations never deduct from Trading Capital or Profit Balance.',
    },
    {
      id: 'faq-privacy-safety',
      category: 'SECURITY',
      question: 'How are my funds, ledger, and personal data protected?',
      answer:
        'Every deposit, signal payout, referral bonus, and withdrawal is recorded in an atomic double-entry ledger with TXID verification. Passwords and Withdraw PINs are salted & bcrypt-hashed, sessions use HttpOnly cookies, zero third-party ad scripts exist, and Master Admin maintains regular database backups.',
    },
  ];
}

export const FIXED_CHATBOT_QUESTIONS: FixedChatbotQuestion[] = [
  {
    id: 'q-deposits',
    label: 'Deposit Tiers & +5%',
    question: 'What are the USDT BEP20 deposit tiers and first deposit bonus?',
    expectedTopic: 'deposit',
  },
  {
    id: 'q-food',
    label: '10% Food Allowance',
    question: 'How does the 10% Food Allowance work?',
    expectedTopic: 'food_allowance',
  },
  {
    id: 'q-signals',
    label: 'Daily Signals & Yield',
    question: 'When are daily signals issued and how is 0.80% yield calculated?',
    expectedTopic: 'signals',
  },
  {
    id: 'q-extra',
    label: '9 PM Extra Signal',
    question: 'Who qualifies for the 9 PM additional signal?',
    expectedTopic: 'signals',
  },
  {
    id: 'q-withdraw',
    label: '15-Day Withdraw Rules',
    question: 'When do profit withdrawals unlock and what are the limits?',
    expectedTopic: 'withdraw',
  },
  {
    id: 'q-wallet',
    label: 'BEP20 Wallet & PIN',
    question: 'Can I change my bound BEP20 wallet address or Withdraw PIN?',
    expectedTopic: 'withdraw',
  },
  {
    id: 'q-referral',
    label: '7% Referral & Team',
    question: 'How do Grade A referral commissions (7%) and team levels work?',
    expectedTopic: 'referral',
  },
  {
    id: 'q-salary',
    label: 'Sunday Salary (L1–L7)',
    question: 'What are the Sunday Salary levels and Team-Matched Cap?',
    expectedTopic: 'salary',
  },
  {
    id: 'q-donations',
    label: 'Donations ($1+ BEP20)',
    question: 'How do community donations ($1+ BEP20) work?',
    expectedTopic: 'donations',
  },
  {
    id: 'q-telegram',
    label: 'Official Telegram Links',
    question: 'Where are the official Telegram group and channel links?',
    expectedTopic: 'telegram',
  },
  {
    id: 'q-privacy',
    label: 'Privacy & Fund Safety',
    question: 'How are my USDT funds and personal data kept safe under Privacy Policy?',
    expectedTopic: 'privacy',
  },
];
