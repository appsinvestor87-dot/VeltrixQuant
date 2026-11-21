'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  HeartHandshake,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { OfflineBanner, PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { TradingTerminalAnalytics } from './TradingTerminalAnalytics';
import {
  DEPOSIT_TIERS,
  MIN_DONATION_USDT,
  formatUsdt,
  type SalaryLevelRule,
} from '@/lib/quant-rules';
import {
  DEFAULT_FAQ_RULES,
  FIXED_CHATBOT_QUESTIONS,
  getPlatformFaqs,
  type FaqCategory,
} from '@/lib/faqs';

type TabId = 'overview' | 'signals' | 'wallet' | 'team' | 'about';

interface DashboardData {
  user: {
    uid: string;
    username: string;
    fullName: string;
    email: string;
    referralCode: string | null;
    capitalBalance: number;
    profitBalance: number;
    lockedProfitBalance: number;
    compoundingBase: number;
    totalDeposited: number;
    totalWithdrawn: number;
    totalEarned: number;
    isDepositActive: boolean;
    isNewMemberWindow: boolean;
    bep20Address: string | null;
    bep20Locked: boolean;
    hasWithdrawPin: boolean;
    joinedAt: number;
  };
  metrics: {
    todayProfit: number;
    pendingSettlementAmount: number;
    pendingSettlementCount: number;
  };
  withdrawLock: {
    hasActiveDeposit: boolean;
    unlocked: boolean;
    unlocksAtMs: number | null;
    remainingMs: number;
    daysElapsed: number;
  };
  schedule: {
    regularTimes: string;
    extraTime: string;
    timezone: string;
    profitPercent: number;
    validityMinutes: number;
    settleMinutes: number;
  };
  announcement: string;
  supportContact: string;
  telegramGroupUrl: string;
  telegramChannelUrl: string;
  recentLedger: Array<{
    id: number;
    type: string;
    wallet_target: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    note: string;
    created_at: number;
  }>;
}

interface DepositTabData {
  tiers: number[];
  accounts: Array<{
    id: number;
    label: string;
    network: string;
    address: string;
    qr_data_url: string;
  }>;
  deposits: Array<{
    id: number;
    amount: number;
    tx_hash: string;
    bsc_verified: number;
    bsc_details: string;
    status: string;
    review_note: string | null;
    created_at: number;
    food_allowance_amount: number | null;
    food_allowance_status: string | null;
  }>;
  rules: {
    firstDepositBonusPct: number;
    foodAllowancePct: number;
    foodAllowanceMin: number;
  };
}

interface WithdrawTabData {
  wallet: {
    bep20Address: string | null;
    bep20Locked: boolean;
    hasWithdrawPin: boolean;
    capitalBalance: number;
    profitBalance: number;
    lockedProfitBalance: number;
  };
  rules: {
    feePercent: number;
    minWithdraw: number;
    lockDays: number;
    todayWithdrawCount: number;
    dailyLimit: number;
  };
  lockStatus: {
    hasActiveDeposit: boolean;
    unlocked: boolean;
    remainingMs: number;
    daysElapsed: number;
  };
  withdrawals: Array<{
    id: number;
    bep20_address: string;
    gross_amount: number;
    fee_percent: number;
    fee_amount: number;
    net_amount: number;
    status: string;
    payout_tx_hash: string | null;
    reject_reason: string | null;
    created_at: number;
  }>;
}

interface DonationTabData {
  minDonationUsdt: number;
  accounts: Array<{
    id: number;
    label: string;
    network: string;
    address: string;
    qr_data_url: string;
  }>;
  donations: Array<{
    id: number;
    amount: number;
    tx_hash: string;
    note: string | null;
    bsc_verified: number;
    bsc_details: string;
    status: string;
    review_note: string | null;
    created_at: number;
    account_label: string | null;
  }>;
  totalApprovedDonated: number;
  totalSubmissions: number;
}

interface TeamTabData {
  isDepositActive: boolean;
  referralCode: string | null;
  directReferralBonusPct: number;
  stats: {
    gradeAActive: number;
    gradeBActive: number;
    gradeCActive: number;
    totalTeamActive: number;
    totalTeamActiveDeposit: number;
  };
  inactiveCount: number;
  totalReferralCommissionEarned: number;
  members: Array<{
    id: number;
    uid: string;
    username: string;
    fullName: string;
    grade: 'A' | 'B' | 'C';
    capitalBalance: number;
    totalDeposited: number;
    isActive: boolean;
    joinedAt: number;
  }>;
  salaryLevels: SalaryLevelRule[];
  salaryStatus: {
    qualifiedLevel: SalaryLevelRule | null;
    estimatedSundayPayout: number;
    baseAmount: number;
  };
  salaryHistory: Array<{
    id: number;
    week_key: string;
    level_achieved: number;
    base_amount: number;
    calc_mode: string;
    rate_value: number;
    payout_amount: number;
    paid_at: number;
  }>;
}

interface AboutTabData {
  rules: {
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
    telegramGroupUrl: string;
    telegramChannelUrl: string;
    timezone: string;
  };
  salaryLevels: SalaryLevelRule[];
  resources: Array<{
    id: number;
    title: string;
    resource_type: 'PDF' | 'POSTER';
    description: string;
    file_data_url: string;
    file_name: string;
    created_at: number;
  }>;
}

interface ChatEntry {
  id: number;
  message: string;
  reply: string;
  is_red_flag: number;
  created_at: number;
}

function formatRemainingDays(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

export function UserDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Wallet tab state
  const [walletSubTab, setWalletSubTab] = useState<'deposit' | 'withdraw' | 'donate'>('deposit');
  const [depositData, setDepositData] = useState<DepositTabData | null>(null);
  const [withdrawData, setWithdrawData] = useState<WithdrawTabData | null>(null);
  const [donationData, setDonationData] = useState<DonationTabData | null>(null);
  const [selectedTier, setSelectedTier] = useState<number>(300);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const [depositTxHash, setDepositTxHash] = useState('');
  const [depositMsg, setDepositMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Donation state ($1+ BEP20)
  const [selectedDonationAccountId, setSelectedDonationAccountId] = useState<number>(1);
  const [donateAmount, setDonateAmount] = useState<string>('5');
  const [donateTxHash, setDonateTxHash] = useState('');
  const [donateNote, setDonateNote] = useState('');
  const [donateMsg, setDonateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingDonation, setSubmittingDonation] = useState(false);

  // Bind wallet & withdraw state
  const [bindAddress, setBindAddress] = useState('');
  const [bindPin, setBindPin] = useState('');
  const [wdAmount, setWdAmount] = useState('');
  const [wdPin, setWdPin] = useState('');
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingWd, setSubmittingWd] = useState(false);

  // Team tab state
  const [teamData, setTeamData] = useState<TeamTabData | null>(null);
  const [teamGradeFilter, setTeamGradeFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');

  // About, FAQs & Chat tab state
  const [aboutData, setAboutData] = useState<AboutTabData | null>(null);
  const [faqCategory, setFaqCategory] = useState<FaqCategory>('ALL');
  const [openFaqId, setOpenFaqId] = useState<string>('faq-deposit-tiers');
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory.length]);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/user/dashboard', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/';
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as DashboardData;
        setDash(data);
      }
    } finally {
      setLoadingDash(false);
    }
  }, []);

  const loadWalletData = useCallback(async () => {
    const [depRes, wdRes, donRes] = await Promise.all([
      fetch('/api/user/deposit', { cache: 'no-store' }),
      fetch('/api/user/withdraw', { cache: 'no-store' }),
      fetch('/api/user/donations', { cache: 'no-store' }),
    ]);
    if (depRes.ok) {
      const dep = (await depRes.json()) as DepositTabData;
      setDepositData(dep);
      if (dep.accounts[0]) setSelectedAccountId(dep.accounts[0].id);
    }
    if (wdRes.ok) {
      const wd = (await wdRes.json()) as WithdrawTabData;
      setWithdrawData(wd);
    }
    if (donRes.ok) {
      const don = (await donRes.json()) as DonationTabData;
      setDonationData(don);
      if (don.accounts[0]) setSelectedDonationAccountId(don.accounts[0].id);
    }
  }, []);

  const loadTeamData = useCallback(async () => {
    const res = await fetch('/api/user/team', { cache: 'no-store' });
    if (res.ok) {
      setTeamData(await res.json());
    }
  }, []);

  const loadAboutAndChat = useCallback(async () => {
    const [aboutRes, chatRes] = await Promise.all([
      fetch('/api/user/about', { cache: 'no-store' }),
      fetch('/api/user/chat', { cache: 'no-store' }),
    ]);
    if (aboutRes.ok) setAboutData(await aboutRes.json());
    if (chatRes.ok) {
      const c = await chatRes.json();
      setChatHistory(c.history || []);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeTab === 'wallet') void loadWalletData();
      if (activeTab === 'team') void loadTeamData();
      if (activeTab === 'about') void loadAboutAndChat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadWalletData, loadTeamData, loadAboutAndChat]);

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositMsg(null);
    setSubmittingDeposit(true);
    try {
      const res = await fetch('/api/user/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedTier,
          txHash: depositTxHash,
          paymentAccountId: selectedAccountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDepositMsg({ type: 'err', text: data.error || 'Deposit submission failed.' });
        return;
      }
      setDepositMsg({
        type: 'ok',
        text: `Deposit #${data.depositId} submitted ($${selectedTier} USDT). Blockchain status: ${data.bscVerification?.summary || 'Pending review.'}`,
      });
      setDepositTxHash('');
      await loadWalletData();
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleBindWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);
    setSubmittingWd(true);
    try {
      const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'BIND_WALLET',
          bep20Address: bindAddress,
          withdrawPin: bindPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawMsg({ type: 'err', text: data.error || 'Unable to bind wallet.' });
        return;
      }
      setWithdrawMsg({
        type: 'ok',
        text: 'BEP20 withdrawal address & PIN bound permanently. Future address changes require Admin verification.',
      });
      setBindAddress('');
      setBindPin('');
      await Promise.all([loadWalletData(), loadDashboard()]);
    } finally {
      setSubmittingWd(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);
    setSubmittingWd(true);
    try {
      const res = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REQUEST_WITHDRAW',
          amount: Number(wdAmount),
          withdrawPin: wdPin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWithdrawMsg({ type: 'err', text: data.error || 'Withdrawal request rejected.' });
        return;
      }
      setWithdrawMsg({
        type: 'ok',
        text: `Withdrawal #${data.withdrawal.id} submitted ($${formatUsdt(data.withdrawal.netAmount)} net USDT after fee).`,
      });
      setWdAmount('');
      setWdPin('');
      await Promise.all([loadWalletData(), loadDashboard()]);
    } finally {
      setSubmittingWd(false);
    }
  };

  const handleDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDonateMsg(null);
    const numericAmount = Number(donateAmount);
    const minReq = donationData?.minDonationUsdt ?? MIN_DONATION_USDT;
    if (!Number.isFinite(numericAmount) || numericAmount < minReq) {
      setDonateMsg({
        type: 'err',
        text: `Minimum community donation is $${minReq} USDT (BEP20).`,
      });
      return;
    }
    setSubmittingDonation(true);
    try {
      const res = await fetch('/api/user/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericAmount,
          txHash: donateTxHash,
          donationAccountId: selectedDonationAccountId,
          note: donateNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDonateMsg({ type: 'err', text: data.error || 'Donation submission failed.' });
        return;
      }
      setDonateMsg({
        type: 'ok',
        text: `Donation #${data.donationId} ($${formatUsdt(numericAmount)} USDT) submitted for verification. Thank you for contributing!`,
      });
      setDonateTxHash('');
      setDonateNote('');
      await Promise.all([loadWalletData(), loadDashboard()]);
    } finally {
      setSubmittingDonation(false);
    }
  };

  const handleSendChat = async (textOverride?: string) => {
    const msg = (textOverride ?? chatInput).trim();
    if (!msg) return;
    setSendingChat(true);
    if (!textOverride) setChatInput('');
    try {
      const res = await fetch('/api/user/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatHistory((prev) => [...prev, data.entry]);
      }
    } finally {
      setSendingChat(false);
    }
  };

  const generateOfficialRulesPdf = () => {
    if (!aboutData) return;
    const doc = new jsPDF();
    const r = aboutData.rules;
    doc.setFillColor(11, 17, 23);
    doc.rect(0, 0, 210, 34, 'F');
    doc.setTextColor(212, 175, 55);
    doc.setFontSize(20);
    doc.text('VELTRIX QUANT', 16, 16);
    doc.setTextColor(226, 232, 240);
    doc.setFontSize(10);
    doc.text('Official Operating Policies, Signal Schedule & Treasury Guide', 16, 25);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    let y = 46;
    const lines = [
      '1. Registration & Account Security',
      '   - Invite-only access: A valid active deposited ($100+) member referral code is required.',
      '   - Email and username remain locked after account creation.',
      '',
      '2. USDT (BEP20) Deposits & Bonuses',
      '   - Accepted Network: USDT BEP20 only (verified via BscScan TXID).',
      '   - Fixed Deposit Tiers: $100, $200, $300, $500, $1,000, $2,000, $3,000, $5,000.',
      `   - First Deposit Bonus: +${r.firstDepositBonusPct}% credited to Profit Balance on first deposit.`,
      `   - Direct Sponsor Commission (Grade A): +${r.directReferralBonusPct}% on every approved deposit.`,
      `   - Food Allowance: Deposits of $${r.foodAllowanceMin}+ earn ${r.foodAllowancePct}% direct to bound BEP20 wallet.`,
      '',
      '3. Daily Signals & Compounding Yield',
      `   - Regular Signals (${r.regularSchedule} ${r.timezone}) & Extra Signal (${r.extraSignalTime}).`,
      `   - Additional 9 PM signal is restricted to new active users (first 3 days) & direct sponsor.`,
      `   - Yield: ${r.signalProfitPercent}% compounded on (Trading Capital + Profit Balance).`,
      `   - Execution Window: ${r.signalValidityMinutes} minutes | Profit Credited: ${r.signalSettleMinutes} minutes after paste.`,
      '',
      '4. Withdrawals & Wallet Rules',
      '   - Deposited Trading Capital stays locked for trading; only Profit Balance is withdrawable.',
      `   - First withdrawal unlocks permanently ${r.withdrawLockDays} days after first approved deposit.`,
      `   - Open 24/7 | 1 withdrawal/day | Min $${r.minWithdrawUsdt} USDT | Fee ${r.withdrawFeePercent}%.`,
      '   - BEP20 withdrawal address binds once; changes require official Admin verification.',
      '',
      '5. Sunday Leadership Salary Levels (Active $100+ Team Only)',
      ...aboutData.salaryLevels.map(
        (lv) =>
          `   - ${lv.name}: ${lv.minDirectActive} Direct A, ${lv.minTeamActive} Team (A+B+C), Own $${lv.minOwnDeposit}+ -> ${lv.calcMode === 'FIXED' ? `$${lv.rateValue}` : `${lv.rateValue}%`}`
      ),
      '',
      '6. Privacy Policy & Member Fund Protection',
      '   - Atomic double-entry ledger records every deposit, signal, bonus, and withdrawal.',
      '   - Credentials and Withdraw PINs are salted & hashed; sessions use HttpOnly signed cookies.',
      '   - Bound BEP20 payout wallets lock permanently once verified.',
      '   - Zero third-party ads or trackers; Master Admin maintains manual disaster-recovery backups.',
      '',
      `Official Support Contact: ${r.supportContact}`,
      ...(r.telegramGroupUrl ? [`Official Telegram Signal Group: ${r.telegramGroupUrl}`] : []),
      ...(r.telegramChannelUrl ? [`Official Telegram Channel: ${r.telegramChannelUrl}`] : []),
    ];

    doc.setFontSize(9.5);
    for (const line of lines) {
      if (y > 276) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 14, y);
      y += 6.2;
    }

    doc.save('Veltrix-Quant-Official-Policies.pdf');
  };

  if (loadingDash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6FA] dark:bg-[#090E14]">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-[#C6972C]/45 bg-[#0B1117] shadow-md">
            <img
              src="/assets/aistudio/image_3a25bab9.png"
              alt="Veltrix Quant"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Loading Veltrix Quant Workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!dash) return null;

  const navItems: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'signals', label: 'Signals', icon: TrendingUp },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'about', label: 'About & Chat', icon: BookOpen },
  ];

  const activeDepositAccount =
    depositData?.accounts.find((a) => a.id === selectedAccountId) || depositData?.accounts[0];
  const activeDonationAccount =
    donationData?.accounts.find((a) => a.id === selectedDonationAccountId) ||
    donationData?.accounts[0];

  const wdNumeric = Number(wdAmount) || 0;
  const wdFeePct = withdrawData?.rules.feePercent ?? 3;
  const wdFeeAmt = Math.round(wdNumeric * (wdFeePct / 100) * 100) / 100;
  const wdNetAmt = Math.max(0, Math.round((wdNumeric - wdFeeAmt) * 100) / 100);

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#090E14] dark:text-slate-100 pb-20 md:pb-8 transition-colors duration-200">
      <OfflineBanner />

      {/* Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#090E14]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-[#C6972C]/45 bg-[#0B1117]">
              <img
                src="/assets/aistudio/image_3a25bab9.png"
                alt="Veltrix Quant"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">
              Veltrix Quant
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 text-sm font-medium transition-colors pb-0.5 ${
                  activeTab === item.id
                    ? 'border-b-2 border-[#B4831D] text-[#8F6510] font-semibold dark:border-[#D4AF37] dark:text-[#D4AF37]'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <PWAInstallButton />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-[#111923] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Announcement Strip */}
        {dash.announcement && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-[#C6972C]/35 bg-white px-4 py-3 text-xs text-slate-700 shadow-xs dark:border-[#D4AF37]/25 dark:bg-[#111923] dark:text-slate-200">
            <p className="leading-relaxed">{dash.announcement}</p>
            <button
              type="button"
              onClick={loadDashboard}
              aria-label="Refresh dashboard"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {dash.user.uid} · @{dash.user.username}
                </p>
                <h1 className="font-display mt-0.5 text-2xl font-bold text-slate-900 dark:text-white">
                  Welcome back, {dash.user.fullName}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('signals')}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354] whitespace-nowrap shrink-0"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Open Signal Terminal</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 dark:border-white/15 dark:bg-[#111923] dark:text-white dark:hover:bg-white/5 whitespace-nowrap shrink-0"
                >
                  <Wallet className="h-4 w-4 text-[#8F6510] dark:text-[#D4AF37]" />
                  <span>Deposit / Withdraw</span>
                </button>
              </div>
            </div>

            {/* Primary Balance Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Trading Capital (Locked)
                </p>
                <p className="font-mono-num mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  ${formatUsdt(dash.user.capitalBalance)}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Used for signal yield · Non-withdrawable
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Withdrawable Profit Balance
                </p>
                <p className="font-mono-num mt-2 text-2xl font-bold text-emerald-700 dark:text-[#10B981]">
                  ${formatUsdt(dash.user.profitBalance)}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Locked in pending withdraw: ${formatUsdt(dash.user.lockedProfitBalance)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Signal Compounding Base
                </p>
                <p className="font-mono-num mt-2 text-2xl font-bold text-[#8F6510] dark:text-[#D4AF37]">
                  ${formatUsdt(dash.user.compoundingBase)}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Capital + Profit · Today: +${formatUsdt(dash.metrics.todayProfit)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  15-Day Withdraw Status
                </p>
                <p
                  className={`font-mono-num mt-2 text-xl font-bold ${
                    dash.withdrawLock.unlocked
                      ? 'text-emerald-700 dark:text-[#10B981]'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {!dash.withdrawLock.hasActiveDeposit
                    ? 'Awaiting Deposit'
                    : dash.withdrawLock.unlocked
                      ? 'Unlocked 24/7'
                      : `${formatRemainingDays(dash.withdrawLock.remainingMs)} Left`}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {dash.metrics.pendingSettlementCount > 0
                    ? `${dash.metrics.pendingSettlementCount} signal processing (+$${formatUsdt(dash.metrics.pendingSettlementAmount)})`
                    : `Signals at ${dash.schedule.regularTimes}`}
                </p>
              </div>
            </div>

            {/* Secondary Split: Schedule + Recent Ledger */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Daily Signal Schedule ({dash.schedule.timezone})
                </h2>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3 dark:border-white/[0.06] dark:bg-[#090E14]">
                    <span className="text-slate-600 dark:text-slate-300">
                      Regular Signals (3 Daily)
                    </span>
                    <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                      {dash.schedule.regularTimes}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3 dark:border-white/[0.06] dark:bg-[#090E14]">
                    <span className="text-slate-600 dark:text-slate-300">
                      Additional (3-Day New &amp; Sponsor)
                    </span>
                    <span className="font-mono-num font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                      {dash.schedule.extraTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-3 dark:border-white/[0.08] dark:bg-[#0B1018]">
                    <span className="text-slate-600 dark:text-slate-300">Yield &amp; Timing</span>
                    <span className="font-mono-num font-medium text-emerald-700 dark:text-[#10B981]">
                      {dash.schedule.profitPercent}% · {dash.schedule.validityMinutes}m valid ·{' '}
                      {dash.schedule.settleMinutes}m payout
                    </span>
                  </div>
                </div>

                {(dash.telegramGroupUrl || dash.telegramChannelUrl) && (
                  <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Official Community Channels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dash.telegramGroupUrl && (
                        <a
                          href={dash.telegramGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 min-w-[155px] min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3 py-1.5 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
                        >
                          <Send className="h-3.5 w-3.5 shrink-0" />
                          <span>Telegram Signal Group</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                      {dash.telegramChannelUrl && (
                        <a
                          href={dash.telegramChannelUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex flex-1 min-w-[155px] min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-[#0B1018] dark:text-slate-200 dark:hover:bg-white/5"
                        >
                          <Send className="h-3.5 w-3.5 shrink-0 text-[#8F6510] dark:text-[#D4AF37]" />
                          <span>Telegram Channel</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <h2 className="font-display mb-4 text-base font-bold text-slate-900 dark:text-white">
                  Recent Account Ledger
                </h2>
                {dash.recentLedger.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No ledger entries yet. Deposit USDT BEP20 to activate trading.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {dash.recentLedger.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-4 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900 dark:text-white">
                            {tx.note}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {tx.type} · {tx.wallet_target} ·{' '}
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`font-mono-num shrink-0 font-semibold ${
                            tx.amount >= 0
                              ? 'text-emerald-700 dark:text-[#10B981]'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {tx.amount >= 0 ? '+' : ''}${formatUsdt(Math.abs(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIGNALS & TRADING ANALYTICS */}
        {activeTab === 'signals' && <TradingTerminalAnalytics onClaimSuccess={loadDashboard} />}

        {/* TAB 3: WALLET (DEPOSIT, WITHDRAW & COMMUNITY DONATION) */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                BEP20 Treasury Wallet
              </h1>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-[#111923]">
                <button
                  type="button"
                  onClick={() => setWalletSubTab('deposit')}
                  className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    walletSubTab === 'deposit'
                      ? 'bg-[#0F172A] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#090E14]'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Deposit USDT (BEP20)
                </button>
                <button
                  type="button"
                  onClick={() => setWalletSubTab('withdraw')}
                  className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    walletSubTab === 'withdraw'
                      ? 'bg-[#0F172A] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#090E14]'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Withdraw Profit
                </button>
                <button
                  type="button"
                  onClick={() => setWalletSubTab('donate')}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    walletSubTab === 'donate'
                      ? 'bg-[#0F172A] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#090E14]'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <HeartHandshake className="h-3.5 w-3.5" />
                  <span>Donate ($1+)</span>
                </button>
              </div>
            </div>

            {walletSubTab === 'deposit' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-5">
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      1. Select Deposit Package (BEP20 Only)
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      First deposit grants +{depositData?.rules.firstDepositBonusPct ?? 5}% Profit
                      Bonus. Deposits of ${depositData?.rules.foodAllowanceMin ?? 300}+ earn{' '}
                      {depositData?.rules.foodAllowancePct ?? 10}% Direct Food Allowance.
                    </p>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {DEPOSIT_TIERS.map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        className={`font-mono-num min-h-[44px] rounded-lg border text-sm font-semibold transition-colors ${
                          selectedTier === tier
                            ? 'border-[#B4831D] bg-[#C6972C]/12 text-[#8F6510] dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-[#090E14] dark:text-slate-300 dark:hover:border-white/25'
                        }`}
                      >
                        ${tier}
                      </button>
                    ))}
                  </div>

                  {activeDepositAccount && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-[#090E14] flex flex-col sm:flex-row items-center gap-4">
                      {activeDepositAccount.qr_data_url && (
                        <img
                          src={activeDepositAccount.qr_data_url}
                          alt="Treasury BEP20 QR"
                          className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1.5 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-2 text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {activeDepositAccount.label}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Network: USDT (BSC / BEP20)
                        </p>
                        <p className="font-mono-num break-all rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium text-[#8F6510] dark:border-white/5 dark:bg-[#111923] dark:text-[#D4AF37]">
                          {activeDepositAccount.address}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyText('treasury', activeDepositAccount.address)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                        >
                          {copiedKey === 'treasury' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-[#10B981]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{copiedKey === 'treasury' ? 'Copied' : 'Copy Address'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleDepositSubmit} className="space-y-3">
                    <div>
                      <label
                        htmlFor="deposit-txid"
                        className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        BscScan Transaction Hash (TXID)
                      </label>
                      <input
                        id="deposit-txid"
                        type="text"
                        required
                        value={depositTxHash}
                        onChange={(e) => setDepositTxHash(e.target.value)}
                        placeholder="0x..."
                        className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                      />
                    </div>

                    {selectedTier >= 300 && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-[#10B981]/25 dark:bg-[#10B981]/10 dark:text-[#10B981]">
                        Qualifies for +${formatUsdt(selectedTier * 0.1)} USDT (10% Food Allowance)
                        sent directly to your bound BEP20 wallet upon approval.
                      </div>
                    )}

                    {depositMsg && (
                      <div
                        className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                          depositMsg.type === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-[#10B981]'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                        }`}
                      >
                        {depositMsg.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingDeposit}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                    >
                      <ArrowDownLeft className="h-4 w-4" />
                      <span>
                        {submittingDeposit
                          ? 'Verifying TXID...'
                          : `Submit $${selectedTier} BEP20 Deposit`}
                      </span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <h2 className="font-display mb-4 text-base font-bold text-slate-900 dark:text-white">
                    Deposit History
                  </h2>
                  {!depositData || depositData.deposits.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No deposit submissions yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {depositData.deposits.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs dark:border-white/[0.07] dark:bg-[#090E14] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                              ${formatUsdt(d.amount)} USDT
                            </span>
                            <span
                              className={`font-semibold ${
                                d.status === 'APPROVED'
                                  ? 'text-emerald-700 dark:text-[#10B981]'
                                  : d.status === 'REJECTED'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <p className="font-mono-num truncate text-[11px] text-slate-500 dark:text-slate-400">
                            TXID: {d.tx_hash}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {d.bsc_details}
                          </p>
                          {d.food_allowance_amount && (
                            <p className="text-[11px] font-medium text-[#8F6510] dark:text-[#D4AF37]">
                              Food Allowance: ${formatUsdt(d.food_allowance_amount)} (
                              {d.food_allowance_status})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : walletSubTab === 'withdraw' ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Profit-Only 24/7 Withdrawal
                    </h2>
                    <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-[#10B981]">
                      Available: ${formatUsdt(withdrawData?.wallet.profitBalance ?? 0)}
                    </span>
                  </div>

                  {withdrawMsg && (
                    <div
                      className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                        withdrawMsg.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-[#10B981]'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                      }`}
                    >
                      {withdrawMsg.text}
                    </div>
                  )}

                  {!withdrawData?.wallet.bep20Locked || !withdrawData?.wallet.bep20Address ? (
                    <form onSubmit={handleBindWallet} className="space-y-3.5">
                      <div className="rounded-xl border border-[#C6972C]/35 bg-[#C6972C]/10 p-3.5 text-xs text-slate-700 dark:border-[#D4AF37]/25 dark:bg-[#D4AF37]/10 dark:text-slate-200">
                        Bind your personal USDT (BEP20) receiving wallet and 4–6 digit Withdraw PIN.
                        Your address locks after saving; future changes require Admin support.
                      </div>
                      <div>
                        <label
                          htmlFor="bind-bep20"
                          className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Your BEP20 Wallet Address
                        </label>
                        <input
                          id="bind-bep20"
                          type="text"
                          required
                          value={bindAddress}
                          onChange={(e) => setBindAddress(e.target.value)}
                          placeholder="0x..."
                          className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs text-slate-900 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="bind-pin"
                          className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Create Withdraw PIN (4–6 digits)
                        </label>
                        <input
                          id="bind-pin"
                          type="password"
                          required
                          inputMode="numeric"
                          value={bindPin}
                          onChange={(e) => setBindPin(e.target.value)}
                          placeholder="e.g. 4466"
                          className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingWd}
                        className="h-11 w-full rounded-lg bg-[#0F172A] text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                      >
                        Bind Wallet &amp; Lock Address
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-white/[0.07] dark:bg-[#090E14] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">
                            Bound BEP20 Wallet (Locked)
                          </span>
                          <span className="font-semibold text-emerald-700 dark:text-[#10B981]">
                            Verified
                          </span>
                        </div>
                        <p className="font-mono-num break-all text-slate-800 dark:text-slate-200">
                          {withdrawData.wallet.bep20Address}
                        </p>
                      </div>

                      {!withdrawData.lockStatus.unlocked && (
                        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                          <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>
                            {withdrawData.lockStatus.hasActiveDeposit
                              ? `Withdrawals unlock in ${formatRemainingDays(withdrawData.lockStatus.remainingMs)} (${withdrawData.rules.lockDays}-day initial maturity).`
                              : `Deposit at least $100 to start your ${withdrawData.rules.lockDays}-day maturity period.`}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="wd-amount"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Amount (Min ${withdrawData.rules.minWithdraw})
                          </label>
                          <input
                            id="wd-amount"
                            type="number"
                            step="0.01"
                            min={withdrawData.rules.minWithdraw}
                            required
                            value={wdAmount}
                            onChange={(e) => setWdAmount(e.target.value)}
                            placeholder="10.00"
                            className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="wd-pin"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Withdraw PIN
                          </label>
                          <input
                            id="wd-pin"
                            type="password"
                            required
                            inputMode="numeric"
                            value={wdPin}
                            onChange={(e) => setWdPin(e.target.value)}
                            placeholder="Enter PIN"
                            className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                        <span>
                          Fee ({wdFeePct}%): ${formatUsdt(wdFeeAmt)}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Net Payout: ${formatUsdt(wdNetAmt)}
                        </span>
                        <span>
                          Today: {withdrawData.rules.todayWithdrawCount}/
                          {withdrawData.rules.dailyLimit}
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingWd || !withdrawData.lockStatus.unlocked}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        <span>
                          {submittingWd ? 'Submitting...' : 'Request Profit Withdrawal'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <h2 className="font-display mb-4 text-base font-bold text-slate-900 dark:text-white">
                    Withdrawal History
                  </h2>
                  {!withdrawData || withdrawData.withdrawals.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No withdrawal requests yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {withdrawData.withdrawals.map((w) => (
                        <div
                          key={w.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs dark:border-white/[0.07] dark:bg-[#090E14] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                              ${formatUsdt(w.gross_amount)} → Net ${formatUsdt(w.net_amount)}
                            </span>
                            <span
                              className={`font-semibold ${
                                w.status === 'PAID'
                                  ? 'text-emerald-700 dark:text-[#10B981]'
                                  : w.status === 'REJECTED'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {w.status}
                            </span>
                          </div>
                          <p className="font-mono-num truncate text-[11px] text-slate-500 dark:text-slate-400">
                            To: {w.bep20_address}
                          </p>
                          {w.payout_tx_hash && (
                            <p className="font-mono-num truncate text-[11px] font-medium text-emerald-700 dark:text-[#10B981]">
                              Payout TXID: {w.payout_tx_hash}
                            </p>
                          )}
                          {w.reject_reason && (
                            <p className="text-[11px] font-medium text-red-600 dark:text-red-300">
                              Refunded: {w.reject_reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Community Donation (USDT BEP20)
                      </h2>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Minimum donation is ${donationData?.minDonationUsdt ?? MIN_DONATION_USDT}{' '}
                        USDT. Voluntary contributions go directly to the Admin-configured BEP20
                        fund and do not alter your Trading Capital or Profit Balance.
                      </p>
                    </div>
                    <span className="font-mono-num shrink-0 rounded-lg border border-[#C6972C]/35 bg-[#C6972C]/10 px-2.5 py-1 text-xs font-semibold text-[#8F6510] dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]">
                      Min $1
                    </span>
                  </div>

                  {activeDonationAccount ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-[#090E14] flex flex-col sm:flex-row items-center gap-4">
                      {activeDonationAccount.qr_data_url && (
                        <img
                          src={activeDonationAccount.qr_data_url}
                          alt="Donation BEP20 QR"
                          className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1.5 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-2 text-xs">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {activeDonationAccount.label}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400">
                          Network: USDT (BSC / BEP20)
                        </p>
                        <p className="font-mono-num break-all rounded-md border border-slate-200 bg-white p-2 text-[11px] font-medium text-[#8F6510] dark:border-white/5 dark:bg-[#111923] dark:text-[#D4AF37]">
                          {activeDonationAccount.address}
                        </p>
                        <button
                          type="button"
                          onClick={() => copyText('donation', activeDonationAccount.address)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-white dark:hover:bg-white/5"
                        >
                          {copiedKey === 'donation' ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-[#10B981]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{copiedKey === 'donation' ? 'Copied' : 'Copy Address'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                      No active donation wallet is configured right now. Please check back later.
                    </div>
                  )}

                  <form onSubmit={handleDonationSubmit} className="space-y-3.5">
                    <div>
                      <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Quick Select Amount (USDT)
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {[1, 5, 10, 25, 50].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDonateAmount(String(amt))}
                            className={`font-mono-num min-h-[40px] rounded-lg border text-xs font-semibold transition-colors ${
                              Number(donateAmount) === amt
                                ? 'border-[#B4831D] bg-[#C6972C]/12 text-[#8F6510] dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-[#090E14] dark:text-slate-300 dark:hover:border-white/25'
                            }`}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="donate-amount"
                          className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Donation Amount (Min $1 USDT)
                        </label>
                        <input
                          id="donate-amount"
                          type="number"
                          step="0.01"
                          min={donationData?.minDonationUsdt ?? MIN_DONATION_USDT}
                          required
                          value={donateAmount}
                          onChange={(e) => setDonateAmount(e.target.value)}
                          placeholder="1.00"
                          className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="donate-note"
                          className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                        >
                          Note / Message (Optional)
                        </label>
                        <input
                          id="donate-note"
                          type="text"
                          maxLength={160}
                          value={donateNote}
                          onChange={(e) => setDonateNote(e.target.value)}
                          placeholder="Community support"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="donate-txid"
                        className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        BscScan Transaction Hash (TXID)
                      </label>
                      <input
                        id="donate-txid"
                        type="text"
                        required
                        value={donateTxHash}
                        onChange={(e) => setDonateTxHash(e.target.value)}
                        placeholder="0x..."
                        className="font-mono-num h-11 w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/10 dark:bg-[#090E14] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                      />
                    </div>

                    {donateMsg && (
                      <div
                        className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                          donateMsg.type === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-[#10B981]'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                        }`}
                      >
                        {donateMsg.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submittingDonation || !activeDonationAccount}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                    >
                      <HeartHandshake className="h-4 w-4" />
                      <span>
                        {submittingDonation
                          ? 'Verifying Donation TXID...'
                          : `Submit $${donateAmount || '1'} BEP20 Donation`}
                      </span>
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-6 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Your Donation History
                    </h2>
                    <span className="font-mono-num text-xs font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                      Approved Total: ${formatUsdt(donationData?.totalApprovedDonated ?? 0)}
                    </span>
                  </div>

                  {!donationData || donationData.donations.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                      No community donations submitted yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {donationData.donations.map((dn) => (
                        <div
                          key={dn.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs dark:border-white/[0.07] dark:bg-[#090E14] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                              ${formatUsdt(dn.amount)} USDT
                            </span>
                            <span
                              className={`font-semibold ${
                                dn.status === 'APPROVED'
                                  ? 'text-emerald-700 dark:text-[#10B981]'
                                  : dn.status === 'REJECTED'
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {dn.status}
                            </span>
                          </div>
                          <p className="font-mono-num truncate text-[11px] text-slate-500 dark:text-slate-400">
                            TXID: {dn.tx_hash}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            {dn.bsc_details}
                          </p>
                          {dn.note && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Note: {dn.note}
                            </p>
                          )}
                          {dn.review_note && (
                            <p className="text-[11px] font-medium text-[#8F6510] dark:text-[#D4AF37]">
                              Admin Review: {dn.review_note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TEAM (GRADE A, B, C & SUNDAY SALARY) */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Team Network &amp; Sunday Salary
              </h1>
              {teamData && (
                <span className="font-mono-num text-xs font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                  Direct Bonus: {teamData.directReferralBonusPct}% · Earned: $
                  {formatUsdt(teamData.totalReferralCommissionEarned)}
                </span>
              )}
            </div>

            {!teamData ? (
              <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/5" />
            ) : !teamData.isDepositActive ? (
              <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-xs dark:border-amber-500/30 dark:bg-[#111923] space-y-3">
                <Lock className="mx-auto h-9 w-9 text-amber-600 dark:text-amber-400" />
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Referral Link Locked Until First Deposit
                </h2>
                <p className="mx-auto max-w-md text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Complete your first approved deposit ($100+ USDT) to unlock your personal referral
                  code, invite link, 7% Grade A commissions, and Sunday Leadership Salaries.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('wallet')}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#0F172A] px-5 py-2 text-xs font-semibold text-white dark:bg-[#D4AF37] dark:text-[#090E14]"
                >
                  Go to Deposit Wallet
                </button>
              </div>
            ) : (
              <>
                {/* Referral Code & Stats Strip */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-3">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Your Active Invite Code
                    </p>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-[#090E14]">
                      <span className="font-mono-num text-lg font-bold text-[#8F6510] dark:text-[#D4AF37]">
                        {teamData.referralCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText('refcode', teamData.referralCode || '')}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#D4AF37] dark:text-[#090E14]"
                      >
                        {copiedKey === 'refcode' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedKey === 'refcode' ? 'Copied' : 'Copy Code'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Earn {teamData.directReferralBonusPct}% instantly into Profit Balance on every
                      approved deposit by your Grade A members. Grade B &amp; C active members count
                      toward Sunday Salary Levels.
                    </p>
                  </div>

                  <div className="lg:col-span-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Grade A (Direct)</p>
                      <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                        {teamData.stats.gradeAActive}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Grade B</p>
                      <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                        {teamData.stats.gradeBActive}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Grade C</p>
                      <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
                        {teamData.stats.gradeCActive}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Inactive ($0)</p>
                      <p className="font-mono-num mt-1.5 text-2xl font-bold text-slate-400">
                        {teamData.inactiveCount}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Salary Levels Progress + Members Table */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Sunday Salary Tiers (1–7)
                      </h2>
                      <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-[#10B981]">
                        Est. ${formatUsdt(teamData.salaryStatus.estimatedSundayPayout)}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs">
                      {teamData.salaryLevels.map((lv) => {
                        const isCurrent = teamData.salaryStatus.qualifiedLevel?.level === lv.level;
                        return (
                          <div
                            key={lv.level}
                            className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 ${
                              isCurrent
                                ? 'border-[#B4831D] bg-[#C6972C]/12 dark:border-[#D4AF37] dark:bg-[#D4AF37]/10'
                                : 'border-slate-200/80 bg-slate-50 dark:border-white/[0.06] dark:bg-[#090E14]'
                            }`}
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {lv.name}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                {lv.minDirectActive} Direct A · {lv.minTeamActive} Team · Own $
                                {lv.minOwnDeposit}+
                              </p>
                            </div>
                            <span className="font-mono-num font-bold text-[#8F6510] dark:text-[#D4AF37]">
                              {lv.calcMode === 'FIXED' ? `$${lv.rateValue}` : `${lv.rateValue}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Team Roster (Active vs Inactive)
                      </h2>
                      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-[#090E14]">
                        {(['ALL', 'A', 'B', 'C'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setTeamGradeFilter(g)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                              teamGradeFilter === g
                                ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                          >
                            {g === 'ALL' ? 'All' : `Grade ${g}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                            <th className="py-2 pr-3 font-semibold">Member</th>
                            <th className="py-2 pr-3 font-semibold">Grade</th>
                            <th className="py-2 pr-3 font-semibold text-right">Active Capital</th>
                            <th className="py-2 font-semibold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono-num dark:divide-white/[0.05]">
                          {teamData.members
                            .filter((m) => teamGradeFilter === 'ALL' || m.grade === teamGradeFilter)
                            .map((m) => (
                              <tr key={`${m.grade}-${m.id}`}>
                                <td className="py-2.5 pr-3 font-sans">
                                  <div className="font-medium text-slate-900 dark:text-white">
                                    {m.fullName}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {m.uid} · @{m.username}
                                  </div>
                                </td>
                                <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">
                                  Grade {m.grade}
                                </td>
                                <td className="py-2.5 pr-3 text-right text-slate-800 dark:text-slate-200">
                                  ${formatUsdt(m.capitalBalance)}
                                </td>
                                <td
                                  className={`py-2.5 text-right font-semibold ${
                                    m.isActive
                                      ? 'text-emerald-700 dark:text-[#10B981]'
                                      : 'text-slate-400 dark:text-slate-500'
                                  }`}
                                >
                                  {m.isActive ? 'Active' : 'Inactive'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 5: ABOUT, POLICIES PDF/POSTERS & ENGLISH CHATBOT */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* About & Official Policies + Posters */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#C6972C]/45 bg-[#0B1117]">
                      <img
                        src="/assets/aistudio/image_3a25bab9.png"
                        alt="Veltrix Quant"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        About Veltrix Quant &amp; Policies
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Transparent Operating Charter &amp; User Documentation
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateOfficialRulesPdf}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#0F172A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354] whitespace-nowrap shrink-0"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Rules PDF</span>
                  </button>
                </div>

                {aboutData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/[0.09] dark:bg-[#0B1018] space-y-1">
                        <p className="font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                          Deposits &amp; Bonuses
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          BEP20 USDT fixed tiers ($100–$5,000). +{aboutData.rules.firstDepositBonusPct}
                          % first deposit bonus · +{aboutData.rules.directReferralBonusPct}% Grade A
                          commission · {aboutData.rules.foodAllowancePct}% direct Food Allowance at $
                          {aboutData.rules.foodAllowanceMin}+.
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/[0.09] dark:bg-[#0B1018] space-y-1">
                        <p className="font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                          Signals &amp; Withdrawals
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          {aboutData.rules.signalProfitPercent}% compounding on (Capital + Profit),{' '}
                          {aboutData.rules.signalValidityMinutes}m valid,{' '}
                          {aboutData.rules.signalSettleMinutes}m payout. Profit withdraw unlocks after{' '}
                          {aboutData.rules.withdrawLockDays} days (24/7, 1/day, min $
                          {aboutData.rules.minWithdrawUsdt}).
                        </p>
                      </div>
                    </div>

                    {/* Privacy Policy & Member Fund Protection Charter */}
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-950/20 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-emerald-800 dark:text-[#10B981]">
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                        <p className="font-display text-sm font-bold">
                          Privacy Policy &amp; Member Fund Protection Charter
                        </p>
                      </div>
                      <ul className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed list-disc pl-4">
                        <li>
                          <strong className="text-slate-900 dark:text-white">Ledger &amp; Capital Safety:</strong>{' '}
                          Every USDT BEP20 deposit, signal yield, referral commission, and withdrawal uses atomic double-entry ledger entries with TXID audit verification.
                        </li>
                        <li>
                          <strong className="text-slate-900 dark:text-white">Credential &amp; Wallet Security:</strong>{' '}
                          Account passwords and Withdraw PINs are salted &amp; hashed with bcrypt. Bound BEP20 payout wallets lock permanently after setup.
                        </li>
                        <li>
                          <strong className="text-slate-900 dark:text-white">Zero Third-Party Ads &amp; Data Privacy:</strong>{' '}
                          We never run intrusive ad scripts, popups, or external trackers, never sell member records, and maintain regular manual database backups against data loss.
                        </li>
                      </ul>
                    </div>

                    {/* Official Telegram Community & Direct Support */}
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/[0.09] dark:bg-[#0B1018] space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          Official Telegram &amp; Support Desk
                        </p>
                        <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                          Support: {aboutData.rules.supportContact}
                        </span>
                      </div>
                      {aboutData.rules.telegramGroupUrl || aboutData.rules.telegramChannelUrl ? (
                        <div className="flex flex-wrap gap-2">
                          {aboutData.rules.telegramGroupUrl && (
                            <a
                              href={aboutData.rules.telegramGroupUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3.5 py-1.5 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>Join Signal Telegram Group</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {aboutData.rules.telegramChannelUrl && (
                            <a
                              href={aboutData.rules.telegramChannelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:bg-[#111923] dark:text-slate-200 dark:hover:bg-white/5"
                            >
                              <Send className="h-3.5 w-3.5 text-[#8F6510] dark:text-[#D4AF37]" />
                              <span>Official Telegram Channel</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-500 dark:text-slate-400">
                          Official Telegram group and channel links configured by Master Admin will appear here automatically.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Frequently Asked Questions (FAQs) */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <HelpCircle className="h-5 w-5 text-[#8F6510] dark:text-[#D4AF37]" />
                    <div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Frequently Asked Questions (FAQs)
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Clear answers on deposits, signal execution, withdrawals, Team-Matched Cap &amp; fund safety.
                      </p>
                    </div>
                  </div>
                </div>

                {/* FAQ Category Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['ALL', 'All'],
                      ['DEPOSITS', 'Deposits'],
                      ['SIGNALS', 'Signals'],
                      ['WITHDRAWALS', 'Withdrawals'],
                      ['TEAM_SALARY', 'Team & Salary'],
                      ['SECURITY', 'Security'],
                    ] as const
                  ).map(([catId, catLabel]) => (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => setFaqCategory(catId)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        faqCategory === catId
                          ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 dark:border-white/10 dark:bg-[#0B1018] dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {catLabel}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {getPlatformFaqs(aboutData?.rules ?? DEFAULT_FAQ_RULES)
                    .filter((item) => faqCategory === 'ALL' || item.category === faqCategory)
                    .map((faq) => {
                      const isOpen = openFaqId === faq.id;
                      return (
                        <div
                          key={faq.id}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/70 dark:border-white/[0.09] dark:bg-[#0B1018]"
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            onClick={() => setOpenFaqId(isOpen ? '' : faq.id)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-semibold text-slate-900 dark:text-white"
                          >
                            <span>{faq.question}</span>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 shrink-0 text-[#8F6510] dark:text-[#D4AF37]" />
                            ) : (
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                          </button>
                          {isOpen && (
                            <p className="border-t border-slate-200/80 px-4 py-3 text-xs leading-relaxed text-slate-600 dark:border-white/[0.08] dark:text-slate-300">
                              {faq.answer}
                            </p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Admin Uploaded PDFs & Posters */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Official Posters &amp; Uploaded Documents
                </h2>
                {!aboutData || aboutData.resources.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    Official posters and additional PDF brochures published by Veltrix Quant Admin
                    will appear here.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {aboutData.resources.map((resItem) => (
                      <div
                        key={resItem.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-white/[0.07] dark:bg-[#090E14] space-y-2.5"
                      >
                        {resItem.resource_type === 'POSTER' &&
                        resItem.file_data_url.startsWith('data:image/') ? (
                          <img
                            src={resItem.file_data_url}
                            alt={resItem.title}
                            className="h-44 w-full rounded-lg object-cover border border-slate-200 dark:border-white/10"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-[#111923]">
                            <FileText className="h-8 w-8 text-[#8F6510] dark:text-[#D4AF37]" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {resItem.title}
                          </p>
                          {resItem.description && (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {resItem.description}
                            </p>
                          )}
                        </div>
                        <a
                          href={resItem.file_data_url}
                          download={resItem.file_name}
                          className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download {resItem.resource_type}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* English-Only Local Support Chatbot with Fixed Verified Questions */}
            <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923] overflow-hidden h-[660px] lg:sticky lg:top-20">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-white/[0.08] dark:bg-[#16202C]">
                <div className="flex items-center gap-2.5">
                  <Shield className="h-4 w-4 text-[#8F6510] dark:text-[#D4AF37]" />
                  <div>
                    <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      Veltrix Support Assistant
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Fixed Policy Questions &amp; Instant Answers
                    </p>
                  </div>
                </div>
                <MessageSquare className="h-4 w-4 text-slate-400" />
              </div>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700 dark:border-white/[0.08] dark:bg-[#0B1018] dark:text-slate-300">
                  Hello! Tap any <strong className="text-slate-900 dark:text-white">Fixed Question</strong> below to receive an instant, verified answer on Veltrix Quant rules—no need to guess what to type.
                </div>

                {chatHistory.map((item) => (
                  <React.Fragment key={item.id}>
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-xl bg-[#0F172A] px-3.5 py-2.5 font-medium text-white dark:bg-[#D4AF37] dark:text-[#090E14]">
                        {item.message}
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[90%] rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 leading-relaxed text-slate-800 dark:border-white/[0.08] dark:bg-[#0B1018] dark:text-slate-200">
                        {item.reply}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Fixed Verified Question Selector */}
              <div className="border-t border-slate-200 bg-slate-50/80 px-3 py-2.5 dark:border-white/[0.08] dark:bg-[#0B1018] space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                    Select a Fixed Question
                  </p>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {FIXED_CHATBOT_QUESTIONS.length} verified topics
                  </span>
                </div>
                <div className="grid max-h-[152px] grid-cols-2 gap-1.5 overflow-y-auto pr-0.5">
                  {FIXED_CHATBOT_QUESTIONS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={sendingChat}
                      onClick={() => handleSendChat(preset.question)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-semibold text-slate-700 transition-colors hover:border-[#B4831D] hover:text-slate-900 disabled:opacity-50 dark:border-white/10 dark:bg-[#111923] dark:text-slate-200 dark:hover:border-[#D4AF37]/60 dark:hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-white/[0.08] dark:bg-[#090E14]"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Or type a custom policy question..."
                  className="h-10 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={sendingChat}
                  aria-label="Send support message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (<= 15% height cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#090E14]/95 md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                active
                  ? 'text-[#8F6510] font-semibold dark:text-[#D4AF37]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
