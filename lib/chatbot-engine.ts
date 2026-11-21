export interface ChatbotSettingsContext {
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
  supportContact: string;
  telegramGroupUrl?: string;
  telegramChannelUrl?: string;
}

export interface ChatbotResponse {
  reply: string;
  isRedFlag: boolean;
  flagReason: string | null;
  topic: string;
}

const RED_FLAG_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(hack|exploit|bypass|sql\s*injection|xss|ddos|crack|steal|leak|phish)\b/i,
    reason: 'Security / exploit probing attempt',
  },
  {
    pattern: /(#admin|admin\s*password|admin\s*panel|secret\s*code|database\s*dump|override\s*balance)/i,
    reason: 'Unauthorized admin credential / system probing',
  },
  {
    pattern: /\b(fake\s*txid|fake\s*deposit|photoshop|double\s*withdraw|scam\s*you|cheat\s*system)\b/i,
    reason: 'Potential financial fraud / abuse intent',
  },
  {
    pattern: /\b(fuck|shit|bitch|asshole|bastard|scammer|fraudster|idiot)\b/i,
    reason: 'Abusive or hostile language',
  },
];

export function processSupportMessage(
  rawMessage: string,
  ctx: ChatbotSettingsContext
): ChatbotResponse {
  const message = rawMessage.trim();
  if (!message) {
    return {
      reply:
        'Hello! Welcome to Veltrix Quant Support. Please ask a question about deposits, signals, withdrawals, bonuses, referrals, or Sunday salaries.',
      isRedFlag: false,
      flagReason: null,
      topic: 'greeting',
    };
  }

  for (const rule of RED_FLAG_PATTERNS) {
    if (rule.pattern.test(message)) {
      return {
        reply: `I can only assist with official Veltrix Quant platform guidelines and policies. Security or unauthorized requests are not permitted. If you have a legitimate account issue, please contact our official support team at ${ctx.supportContact}.`,
        isRedFlag: true,
        flagReason: rule.reason,
        topic: 'red_flag',
      };
    }
  }

  const lower = message.toLowerCase();

  if (/^(hi|hello|hey|salam|assalam|good\s*(morning|afternoon|evening))\b/i.test(lower)) {
    return {
      reply:
        'Hello! I am the Veltrix Quant Support Assistant. Ask me about USDT BEP20 deposits, daily signal timings, withdrawals, 10% food allowance, referral bonuses, or Sunday salary levels.',
      isRedFlag: false,
      flagReason: null,
      topic: 'greeting',
    };
  }

  if (/(food\s*allowance|allowance|300)/i.test(lower)) {
    return {
      reply: `Food Allowance Policy: Deposits of $${ctx.foodAllowanceMin} USDT and above ($300, $500, $1,000, $2,000, $3,000, $5,000) qualify for a ${ctx.foodAllowancePct}% Food Allowance. This reward is sent directly to your bound BEP20 wallet address rather than your in-app trading wallet.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'food_allowance',
    };
  }

  if (/(donat|charity|qr\s*wallet|minimum\s*1)/i.test(lower)) {
    return {
      reply:
        'Community Donations ($1+ BEP20): Voluntary donations starting at $1 USDT (BEP20) can be submitted from Wallet -> Donate using the Admin-configured donation address or QR code and your BscScan TXID. Donations never deduct from your Trading Capital or Profit Balance.',
      isRedFlag: false,
      flagReason: null,
      topic: 'donations',
    };
  }

  if (/(withdraw|cashout|payout|15\s*day|fee|wallet\s*address|bound\s*bep20|withdraw\s*pin|change.*wallet|change.*address|capital)/i.test(lower)) {
    return {
      reply: `Withdrawal & Wallet Policy: Deposited Trading Capital stays locked for signal execution; only Profit Balance can be withdrawn. Withdrawals unlock permanently ${ctx.withdrawLockDays} days after your first approved deposit and run 24/7 (1 withdrawal per day, minimum $${ctx.minWithdrawUsdt} USDT, ${ctx.withdrawFeePercent}% fee). Your BEP20 address binds once with your Withdraw PIN—future changes require official Master Admin support.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'withdraw',
    };
  }

  if (/(refer|referral|invite|sponsor|commission|grade\s*a|7%)/i.test(lower)) {
    return {
      reply: `Referral & Team Policy: Registration is invite-only and requires a valid active member referral code. Your own referral link unlocks once your first deposit is approved. Direct Grade A referrals grant you +${ctx.directReferralBonusPct}% of every approved deposit into your Profit Balance, while Grade B and Grade C active members count toward your Sunday Salary rank.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'referral',
    };
  }

  if (/(deposit|tier|package|bep20|txid|bscscan|minimum\s*deposit)/i.test(lower)) {
    return {
      reply: `Deposit Policy: Veltrix Quant accepts USDT (BEP20) only across fixed tiers: $100, $200, $300, $500, $1,000, $2,000, $3,000, and $5,000. Submit your exact amount and BscScan TXID for verification. Your first approved deposit grants a +${ctx.firstDepositBonusPct}% bonus to your Profit Balance.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'deposit',
    };
  }

  if (/(signal|4\s*pm|6\s*pm|8\s*pm|9\s*pm|time|timing|schedule|paste|additional|extra|0\.80)/i.test(lower)) {
    return {
      reply: `Signal Schedule & Execution: An approved deposit ($100+) is required to unlock signals. Three regular signals are issued daily at ${ctx.regularSchedule}, plus an additional signal at ${ctx.extraSignalTime} exclusively for newly deposited users (first 3 days) and their direct sponsor (max 1/day). Each signal remains valid for ${ctx.signalValidityMinutes} minutes, yields ${ctx.signalProfitPercent}% compounding on (Trading Capital + Profit Balance), and credits profit after ${ctx.signalSettleMinutes} minutes.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'signals',
    };
  }

  if (/(salary|sunday|level|grade|rank|team[- ]matched)/i.test(lower)) {
    return {
      reply:
        'Sunday Salary Program: Salaries are processed every Sunday across 7 levels (default Fixed $10, $25, $50, $100, $150, $300, $500) based on active ($100+) Grade A directs, Grade A+B+C team size, and minimum own capital. Under Team-Matched Cap, percentage calculations are capped at min(Own Capital, Active Team Deposit) so inactive ($0) accounts cannot inflate ranks.',
      isRedFlag: false,
      flagReason: null,
      topic: 'salary',
    };
  }

  if (/(telegram|group|channel|community|link)/i.test(lower)) {
    const links: string[] = [];
    if (ctx.telegramGroupUrl) links.push(`Telegram Signal Group: ${ctx.telegramGroupUrl}`);
    if (ctx.telegramChannelUrl) links.push(`Official Telegram Channel: ${ctx.telegramChannelUrl}`);
    return {
      reply:
        links.length > 0
          ? `Official Veltrix Quant Community Links — ${links.join(' · ')}. Always verify signal codes only from official links shown inside your dashboard.`
          : `Official Telegram Group & Channel links are managed by Admin and appear directly on your Dashboard Overview & Signal Desk once published. Support contact: ${ctx.supportContact}.`,
      isRedFlag: false,
      flagReason: null,
      topic: 'telegram',
    };
  }

  if (/(privacy|data|safe|security|protect|encrypt|fund\s*safety)/i.test(lower)) {
    return {
      reply:
        'Privacy & Fund Protection Policy: Every USDT deposit, ledger balance, and withdrawal request is stored in atomic database records with immutable audit logs. Passwords and Withdraw PINs are salted & bcrypt-hashed, sessions run over HttpOnly signed cookies, no ad trackers exist anywhere, and full ledger backups are maintained for disaster recovery.',
      isRedFlag: false,
      flagReason: null,
      topic: 'privacy',
    };
  }

  if (/(rule|policy|pdf|about|terms|legal|faq)/i.test(lower)) {
    return {
      reply:
        'All Veltrix Quant Terms, Privacy Policy Charter, Frequently Asked Questions (FAQs), official posters, and the downloadable Rules PDF are available right here in the About & Policies section.',
      isRedFlag: false,
      flagReason: null,
      topic: 'about',
    };
  }

  return {
    reply: `Please select one of the Fixed Questions below for an instant verified policy answer, or browse the FAQs section on the left. For account-specific assistance, contact official support at ${ctx.supportContact}.`,
    isRedFlag: false,
    flagReason: null,
    topic: 'fallback',
  };
}
