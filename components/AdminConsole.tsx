'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Ban,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  HeartHandshake,
  KeyRound,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sliders,
  Trash2,
  TrendingUp,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  X,
} from 'lucide-react';
import { formatUsdt, type SalaryLevelRule } from '@/lib/quant-rules';
import { ThemeToggle } from './ThemeToggle';

type SectionId =
  | 'overview'
  | 'users'
  | 'new_members'
  | 'block_unblock'
  | 'balance_adjust'
  | 'deposits'
  | 'payment_accounts'
  | 'donations'
  | 'food_allowance'
  | 'withdraws'
  | 'withdraw_tracker'
  | 'signals'
  | 'team_salary'
  | 'about_resources'
  | 'backup'
  | 'security_audit';

interface AdminConsoleProps {
  adminName: string;
  adminRole?: 'MASTER_ADMIN';
}

interface OverviewPayload {
  admin: { displayName: string; role: 'MASTER_ADMIN' };
  overview: {
    totalUsers: number;
    activeUsers: number;
    blockedUsers: number;
    newDepositedUsers: number;
    totalCapital: number;
    totalProfitBalance: number;
    totalApprovedDeposits: number;
    pendingDepositsCount: number;
    pendingDepositsAmount: number;
    totalPaidWithdrawals: number;
    pendingWithdrawalsCount: number;
    pendingWithdrawalsNet: number;
    pendingFoodAllowancesCount: number;
    pendingFoodAllowancesAmount: number;
    signalClaimsToday: number;
    signalProfitToday: number;
    unreviewedRedFlags: number;
    netTreasuryFlow: number;
    totalApprovedDonations?: number;
    pendingDonationsCount?: number;
  };
}

interface AdminUserRow {
  id: number;
  uid: string;
  username: string;
  full_name: string;
  email: string;
  referral_code: string;
  sponsor_uid: string | null;
  sponsor_username: string | null;
  bep20_address: string | null;
  bep20_locked: number;
  capital_balance: number;
  profit_balance: number;
  locked_profit_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_earned: number;
  first_deposit_at: number | null;
  status: string;
  block_reason: string | null;
  last_login_ip: string | null;
  created_at: number;
  today_profit: number;
  lifetime_signals: number;
  missed_signals: number;
  active_direct_count: number;
}

interface UserDetailPayload {
  user: AdminUserRow;
  ledger: Array<{
    id: number;
    type: string;
    wallet_target: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    reference_id: string | null;
    note: string | null;
    created_at: number;
  }>;
  claims: Array<{
    id: number;
    signal_code: string;
    pair: string;
    signal_type: string;
    expected_profit: number;
    status: string;
    claimed_at: number;
  }>;
  deposits: Array<{
    id: number;
    amount: number;
    tx_hash: string;
    status: string;
    created_at: number;
  }>;
  withdrawals: Array<{
    id: number;
    gross_amount: number;
    net_amount: number;
    status: string;
    created_at: number;
  }>;
  team: {
    stats: {
      gradeAActive: number;
      gradeBActive: number;
      gradeCActive: number;
      totalTeamActive: number;
      totalTeamActiveDeposit: number;
    };
    inactiveCount: number;
  };
}

interface NewMembersPayload {
  activeNewMembers: Array<{
    id: number;
    uid: string;
    username: string;
    full_name: string;
    email: string;
    capital_balance: number;
    profit_balance: number;
    total_deposited: number;
    first_deposit_at: number;
    sponsor_uid: string | null;
    sponsor_username: string | null;
  }>;
  unfundedNewMembers: Array<{
    id: number;
    uid: string;
    username: string;
    full_name: string;
    email: string;
    created_at: number;
    sponsor_uid: string | null;
    sponsor_username: string | null;
  }>;
}

interface DepositRow {
  id: number;
  user_id: number;
  uid: string;
  username: string;
  full_name: string;
  email: string;
  user_bep20: string | null;
  amount: number;
  tx_hash: string;
  bsc_verified: number;
  bsc_details: string | null;
  status: string;
  review_note: string | null;
  reviewed_by: string | null;
  account_label: string | null;
  treasury_address: string | null;
  created_at: number;
}

interface PaymentAccountRow {
  id: number;
  label: string;
  network: string;
  address: string;
  qr_data_url: string | null;
  is_active: number;
  created_at: number;
}

interface FoodAllowanceRow {
  id: number;
  deposit_id: number;
  uid: string;
  username: string;
  full_name: string;
  deposit_amount: number;
  allowance_amount: number;
  bep20_address: string | null;
  current_user_bep20: string | null;
  status: string;
  payout_tx_hash: string | null;
  paid_by: string | null;
  paid_at: number | null;
  created_at: number;
}

interface WithdrawRow {
  id: number;
  user_id: number;
  uid: string;
  username: string;
  full_name: string;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  bep20_address: string;
  status: string;
  payout_tx_hash: string | null;
  reject_reason: string | null;
  total_deposited: number;
  total_withdrawn: number;
  created_at: number;
  reviewed_at: number | null;
}

interface WithdrawTrackerPayload {
  history: WithdrawRow[];
  perUserSummary: Array<{
    user_id: number;
    uid: string;
    username: string;
    full_name: string;
    paid_count: number;
    total_gross_paid: number;
    total_net_paid: number;
    last_paid_at: number | null;
  }>;
}

interface AdminSignalRow {
  id: number;
  signal_code: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  signal_type: 'REGULAR' | 'ADDITIONAL';
  profit_percent: number;
  starts_at: number;
  expires_at: number;
  settle_delay_minutes: number;
  note: string | null;
  target_user_id: number | null;
  target_username: string | null;
  target_uid: string | null;
  is_test: number;
  created_by: string | null;
  claims_count: number;
  total_profit_allocated: number;
}

interface SignalsPayload {
  signals: AdminSignalRow[];
  defaults: {
    profitPercent: number;
    validityMinutes: number;
    settleDelayMinutes: number;
    regularTimes: string;
    extraTime: string;
    timezone: string;
  };
}

interface TeamSalaryPayload {
  currentWeek: string;
  levels: SalaryLevelRule[];
  leaders: Array<{
    userId: number;
    uid: string;
    username: string;
    fullName: string;
    ownCapital: number;
    gradeAActive: number;
    gradeBActive: number;
    gradeCActive: number;
    totalTeamActive: number;
    inactiveTeamCount: number;
    totalTeamActiveDeposit: number;
    qualifiedLevel: number;
    qualifiedLevelName: string;
    calcMode: 'PERCENTAGE' | 'FIXED';
    rateValue: number;
    baseAmount: number;
    estimatedSalary: number;
    paidThisWeek: boolean;
  }>;
  payouts: Array<{
    id: number;
    uid: string;
    username: string;
    full_name: string;
    week_key: string;
    level_achieved: number;
    base_amount: number;
    calc_mode: string;
    rate_value: number;
    payout_amount: number;
    paid_by: string;
    paid_at: number;
  }>;
}

interface AboutResourceRow {
  id: number;
  title: string;
  resource_type: 'PDF' | 'POSTER';
  description: string | null;
  file_data_url: string;
  file_name: string;
  uploaded_by: string | null;
  created_at: number;
}

interface SecurityPayload {
  auditLogs: Array<{
    id: number;
    admin_name: string;
    admin_role: string;
    action: string;
    target_type: string;
    target_id: string | null;
    details_json: string | null;
    ip_address: string | null;
    created_at: number;
  }>;
  ipLocks: Array<{
    ip: string;
    failed_attempts: number;
    locked_until: number | null;
    last_attempt_at: number;
    reason: string | null;
  }>;
  chatFlags: Array<{
    id: number;
    uid: string | null;
    username: string | null;
    message: string;
    reply: string;
    flag_reason: string | null;
    reviewed: number;
    created_at: number;
  }>;
  recentChats: Array<{
    id: number;
    uid: string | null;
    username: string | null;
    message: string;
    reply: string;
    is_red_flag: number;
    created_at: number;
  }>;
}

interface AdminAccountSummary {
  id: number;
  triggerId: string;
  role: 'MASTER_ADMIN';
  displayName: string;
  isActive: boolean;
  createdAt: number;
}

interface DonationsAdminPayload {
  accounts: PaymentAccountRow[];
  donations: Array<{
    id: number;
    user_id: number;
    uid: string;
    username: string;
    full_name: string;
    email: string;
    amount: number;
    tx_hash: string;
    note: string | null;
    bsc_verified: number;
    bsc_details: string | null;
    status: string;
    reviewed_by: string | null;
    review_note: string | null;
    account_label: string | null;
    receiving_address: string | null;
    created_at: number;
    reviewed_at: number | null;
  }>;
  summary: {
    totalApprovedAmount: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    uniqueDonors: number;
  };
}

interface BackupMetaPayload {
  dbFileName: string;
  dbSizeBytes: number;
  walSizeBytes: number;
  lastModifiedAt: number;
  tables: Array<{ name: string; rowCount: number }>;
  recentBackups: Array<{
    id: number;
    admin_name: string;
    admin_role: string;
    details_json: string | null;
    ip_address: string | null;
    created_at: number;
  }>;
}

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users & Signals Stats', icon: Users },
  { id: 'new_members', label: 'New Members (3d)', icon: UserPlus },
  { id: 'block_unblock', label: 'Block & IP Locks', icon: Ban },
  { id: 'balance_adjust', label: 'Balance Adjust', icon: Sliders },
  { id: 'deposits', label: 'Deposits (BEP20)', icon: ArrowDownLeft },
  { id: 'payment_accounts', label: 'Company Wallets', icon: CreditCard },
  { id: 'donations', label: 'Donations ($1+ & QR)', icon: HeartHandshake },
  { id: 'food_allowance', label: 'Food Allowance (10%)', icon: Utensils },
  { id: 'withdraws', label: 'Withdraw Queue', icon: ArrowUpRight },
  { id: 'withdraw_tracker', label: 'Withdraw Tracker', icon: Wallet },
  { id: 'signals', label: 'Signal Generator', icon: TrendingUp },
  { id: 'team_salary', label: 'Team & Sunday Salary', icon: Award },
  { id: 'about_resources', label: 'About PDF & Posters', icon: BookOpen },
  { id: 'backup', label: 'Database Backup', icon: Database },
  { id: 'security_audit', label: 'Audit, Flags & Settings', icon: Settings },
];

function fmtDate(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SETTING_LABELS: Record<string, { label: string; hint?: string; placeholder?: string }> = {
  withdraw_fee_percent: { label: 'Withdrawal Fee (%)', hint: 'Applied on profit withdrawals' },
  min_withdraw_usdt: { label: 'Minimum Withdrawal (USDT)', hint: 'Default 10 USDT' },
  withdraw_lock_days: { label: 'First Deposit Lock (Days)', hint: 'Maturity before 1st withdraw (15d)' },
  signal_default_profit_pct: { label: 'Default Signal Yield (%)', hint: 'Compounded on Capital + Profit' },
  signal_validity_minutes: { label: 'Signal Validity Window (Min)', hint: 'Default 30 minutes' },
  signal_settle_minutes: { label: 'Signal Settlement Delay (Min)', hint: 'Default 20 minutes' },
  signal_schedule_times: { label: 'Daily Regular Windows', hint: 'Comma-separated 24h times' },
  extra_signal_time: { label: 'New Member / Sponsor Extra', hint: 'Daily 9 PM cohort window' },
  first_deposit_bonus_pct: { label: 'First Deposit Profit Bonus (%)', hint: 'Credited on 1st deposit' },
  direct_referral_bonus_pct: { label: 'Direct Grade A Bonus (%)', hint: 'Instant sponsor commission' },
  food_allowance_pct: { label: 'Food Allowance Rate (%)', hint: 'External BEP20 payout' },
  food_allowance_min: { label: 'Food Allowance Min Deposit ($)', hint: 'Default $300 tier' },
  timezone: { label: 'Platform Timezone', hint: 'e.g. Asia/Karachi' },
  admin_idle_lock_minutes: { label: 'Admin Idle Auto-Lock (Min)', hint: 'Security lock timeout (120m)' },
};

const HIDDEN_SETTINGS = new Set([
  'salary_defaults_migrated_v2',
  'telegram_group_url',
  'telegram_channel_url',
  'support_contact',
  'announcement_text',
]);

export function AdminConsole({ adminName }: AdminConsoleProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0); // 0 = Off (zero per-second polling!)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [idleLockedNotice, setIdleLockedNotice] = useState(false);

  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Isolated section state (loaded only on click)
  const [overviewData, setOverviewData] = useState<OverviewPayload | null>(null);
  const [usersData, setUsersData] = useState<AdminUserRow[] | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'DEPOSITED'>('ALL');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetailPayload | null>(null);

  // User Detail Drawer edit inputs
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [resetPwVal, setResetPwVal] = useState('');
  const [resetPinVal, setResetPinVal] = useState('');
  const [walletOverrideVal, setWalletOverrideVal] = useState('');

  // New Members
  const [newMembersData, setNewMembersData] = useState<NewMembersPayload | null>(null);
  const [newMemberTab, setNewMemberTab] = useState<'ACTIVE' | 'UNFUNDED'>('ACTIVE');

  // Block / Unblock
  const [blockUserId, setBlockUserId] = useState<number>(0);
  const [blockReason, setBlockReason] = useState('');
  const [ipLocksList, setIpLocksList] = useState<SecurityPayload['ipLocks']>([]);

  // Balance Adjust
  const [adjUserId, setAdjUserId] = useState<number>(0);
  const [adjTarget, setAdjTarget] = useState<'CAPITAL' | 'PROFIT'>('PROFIT');
  const [adjOp, setAdjOp] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Deposits
  const [depositsList, setDepositsList] = useState<DepositRow[] | null>(null);
  const [depositFilter, setDepositFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [depositNoteMap, setDepositNoteMap] = useState<Record<number, string>>({});

  // Payment Accounts
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountRow[] | null>(null);
  const [newAccLabel, setNewAccLabel] = useState('');
  const [newAccAddress, setNewAccAddress] = useState('');
  const [newAccCustomQr, setNewAccCustomQr] = useState('');

  // Food Allowance
  const [foodItems, setFoodItems] = useState<FoodAllowanceRow[] | null>(null);
  const [foodTxMap, setFoodTxMap] = useState<Record<number, string>>({});

  // Withdrawals & Tracker
  const [pendingWithdraws, setPendingWithdraws] = useState<WithdrawRow[] | null>(null);
  const [wdTxMap, setWdTxMap] = useState<Record<number, string>>({});
  const [wdRejectMap, setWdRejectMap] = useState<Record<number, string>>({});
  const [trackerData, setTrackerData] = useState<WithdrawTrackerPayload | null>(null);

  // Signals
  const [signalsData, setSignalsData] = useState<SignalsPayload | null>(null);
  const [sigPair, setSigPair] = useState('BTC/USDT');
  const [sigDir, setSigDir] = useState<'LONG' | 'SHORT'>('LONG');
  const [sigType, setSigType] = useState<'REGULAR' | 'ADDITIONAL'>('REGULAR');
  const [sigPct, setSigPct] = useState('0.80');
  const [sigValidity, setSigValidity] = useState('30');
  const [sigSettle, setSigSettle] = useState('20');
  const [sigCode, setSigCode] = useState('');
  const [sigNote, setSigNote] = useState('');
  const [sigTargetUser, setSigTargetUser] = useState('');
  const [sigIsTest, setSigIsTest] = useState(false);
  const [editingSignal, setEditingSignal] = useState<{
    id: number;
    startsAtLocal: string;
    expiresAtLocal: string;
    profitPercent: string;
  } | null>(null);

  // Team & Salary
  const [teamSalaryData, setTeamSalaryData] = useState<TeamSalaryPayload | null>(null);
  const [editableLevels, setEditableLevels] = useState<SalaryLevelRule[]>([]);

  // About Resources
  const [aboutResources, setAboutResources] = useState<AboutResourceRow[] | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resType, setResType] = useState<'PDF' | 'POSTER'>('POSTER');
  const [resDesc, setResDesc] = useState('');
  const [resFileName, setResFileName] = useState('');
  const [resDataUrl, setResDataUrl] = useState('');

  // Security, Audit, Flags, Settings & Admin Passwords
  const [securityData, setSecurityData] = useState<SecurityPayload | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, string> | null>(null);
  const [secSubTab, setSecSubTab] = useState<'AUDIT' | 'FLAGS' | 'IP' | 'SETTINGS' | 'PASSWORDS'>('AUDIT');
  const [savingSettings, setSavingSettings] = useState(false);
  const [curMasterPass1, setCurMasterPass1] = useState('');
  const [curMasterPass2, setCurMasterPass2] = useState('');
  const [newAdminPass1, setNewAdminPass1] = useState('');
  const [newAdminPass2, setNewAdminPass2] = useState('');
  const [showPwFields, setShowPwFields] = useState(false);
  const [savingAdminPw, setSavingAdminPw] = useState(false);

  // Donations ($1+ BEP20 & Auto QR)
  const [donationsData, setDonationsData] = useState<DonationsAdminPayload | null>(null);
  const [donationFilter, setDonationFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [donAccLabel, setDonAccLabel] = useState('');
  const [donAccAddress, setDonAccAddress] = useState('');
  const [donAccCustomQr, setDonAccCustomQr] = useState('');
  const [donNoteMap, setDonNoteMap] = useState<Record<number, string>>({});

  // Manual Database Backup
  const [backupMeta, setBackupMeta] = useState<BackupMetaPayload | null>(null);
  const [downloadingBackupFormat, setDownloadingBackupFormat] = useState<string | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleApiResponse = useCallback(async (res: Response) => {
    if (res.status === 401) {
      const d = await res.json().catch(() => ({}));
      if (d?.code === 'ADMIN_IDLE_LOCKED') {
        setIdleLockedNotice(true);
      }
      throw new Error(d?.error || 'Session expired.');
    }
    if (res.status === 404) {
      window.location.href = '/';
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Request failed.');
    }
    return data;
  }, []);

  const fetchSection = useCallback(
    async (section: SectionId) => {
      setLoading(true);
      try {
        if (section === 'overview') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/overview', { cache: 'no-store' })
          )) as OverviewPayload;
          setOverviewData(data);
        } else if (section === 'users') {
          const data = await handleApiResponse(
            await fetch('/api/admin/users', { cache: 'no-store' })
          );
          setUsersData(data.users);
        } else if (section === 'new_members') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/new-members', { cache: 'no-store' })
          )) as NewMembersPayload;
          setNewMembersData(data);
        } else if (section === 'block_unblock') {
          const [uData, sData] = await Promise.all([
            handleApiResponse(await fetch('/api/admin/users', { cache: 'no-store' })),
            handleApiResponse(await fetch('/api/admin/security', { cache: 'no-store' })),
          ]);
          setUsersData(uData.users);
          setIpLocksList(sData.ipLocks);
        } else if (section === 'balance_adjust') {
          const uData = await handleApiResponse(
            await fetch('/api/admin/users', { cache: 'no-store' })
          );
          setUsersData(uData.users);
        } else if (section === 'deposits') {
          const data = await handleApiResponse(
            await fetch(`/api/admin/deposits?status=${depositFilter}`, { cache: 'no-store' })
          );
          setDepositsList(data.deposits);
        } else if (section === 'payment_accounts') {
          const data = await handleApiResponse(
            await fetch('/api/admin/payment-accounts', { cache: 'no-store' })
          );
          setPaymentAccounts(data.accounts);
        } else if (section === 'donations') {
          const data = (await handleApiResponse(
            await fetch(`/api/admin/donations?status=${donationFilter}`, { cache: 'no-store' })
          )) as DonationsAdminPayload;
          setDonationsData(data);
        } else if (section === 'food_allowance') {
          const data = await handleApiResponse(
            await fetch('/api/admin/food-allowance', { cache: 'no-store' })
          );
          setFoodItems(data.items);
        } else if (section === 'withdraws') {
          const data = await handleApiResponse(
            await fetch('/api/admin/withdraws', { cache: 'no-store' })
          );
          setPendingWithdraws(data.withdraws);
        } else if (section === 'withdraw_tracker') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/withdraw-tracker', { cache: 'no-store' })
          )) as WithdrawTrackerPayload;
          setTrackerData(data);
        } else if (section === 'signals') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/signals', { cache: 'no-store' })
          )) as SignalsPayload;
          setSignalsData(data);
          setSigPct(String(data.defaults.profitPercent));
          setSigValidity(String(data.defaults.validityMinutes));
          setSigSettle(String(data.defaults.settleDelayMinutes));
        } else if (section === 'team_salary') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/team-salary', { cache: 'no-store' })
          )) as TeamSalaryPayload;
          setTeamSalaryData(data);
          setEditableLevels(data.levels);
        } else if (section === 'about_resources') {
          const data = await handleApiResponse(
            await fetch('/api/admin/about-resources', { cache: 'no-store' })
          );
          setAboutResources(data.resources);
        } else if (section === 'backup') {
          const data = (await handleApiResponse(
            await fetch('/api/admin/backup', { cache: 'no-store' })
          )) as BackupMetaPayload;
          setBackupMeta(data);
        } else if (section === 'security_audit') {
          const [sec, setRes] = await Promise.all([
            handleApiResponse(await fetch('/api/admin/security', { cache: 'no-store' })),
            handleApiResponse(await fetch('/api/admin/settings', { cache: 'no-store' })),
          ]);
          setSecurityData(sec);
          setSettingsMap(setRes.settings);
        }
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (err instanceof Error && err.message !== 'Unauthorized') {
          notify('err', err.message);
        }
      } finally {
        setLoading(false);
      }
    },
    [depositFilter, donationFilter, handleApiResponse]
  );

  // Load only the clicked section on section switch
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSection(activeSection);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeSection, fetchSection]);

  // Optional slow auto-refresh (Off / 30s / 60s / 120s) with tab-visibility pause — NEVER per-second!
  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSection(activeSection);
      }
    }, autoRefreshSec * 1000);
    return () => window.clearInterval(id);
  }, [autoRefreshSec, activeSection, fetchSection]);

  const handleLockOrLogout = async (fullLogout: boolean) => {
    await fetch('/api/auth/admin-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullLogout }),
    });
    window.location.href = fullLogout ? '/' : '/admin';
  };

  const openUserDetail = async (userId: number) => {
    try {
      const data = (await handleApiResponse(
        await fetch(`/api/admin/users/${userId}`)
      )) as UserDetailPayload;
      setSelectedUserDetail(data);
      setEditFullName(data.user.full_name);
      setEditEmail(data.user.email);
      setWalletOverrideVal(data.user.bep20_address || '');
      setResetPwVal('');
      setResetPinVal('');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const patchUser = async (userId: number, payload: Record<string, unknown>, successMsg: string) => {
    try {
      await handleApiResponse(
        await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      );
      notify('ok', successMsg);
      await fetchSection(activeSection);
      if (selectedUserDetail?.user.id === userId) {
        await openUserDetail(userId);
      }
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!usersData) return [];
    const q = userSearch.trim().toLowerCase();
    return usersData.filter((u) => {
      if (userFilter === 'ACTIVE' && u.status !== 'ACTIVE') return false;
      if (userFilter === 'BLOCKED' && u.status === 'ACTIVE') return false;
      if (userFilter === 'DEPOSITED' && u.capital_balance < 100) return false;
      if (!q) return true;
      return (
        u.uid.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q)
      );
    });
  }, [usersData, userSearch, userFilter]);

  const handleDepositAction = async (
    depositId: number,
    action: 'VERIFY_BSCSCAN' | 'APPROVE' | 'REJECT'
  ) => {
    try {
      const note = depositNoteMap[depositId] || '';
      const data = await handleApiResponse(
        await fetch(`/api/admin/deposits/${depositId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, note: note || undefined }),
        })
      );
      if (action === 'VERIFY_BSCSCAN') {
        notify(
          data.bscVerification?.verifiedOnChain ? 'ok' : 'err',
          data.bscVerification?.summary || 'BscScan check completed.'
        );
      } else {
        notify('ok', `Deposit #${depositId} ${action === 'APPROVE' ? 'approved' : 'rejected'}.`);
      }
      await fetchSection('deposits');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleBalanceAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleApiResponse(
        await fetch('/api/admin/balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: Number(adjUserId),
            walletTarget: adjTarget,
            operation: adjOp,
            amount: Number(adjAmount),
            reason: adjReason,
          }),
        })
      );
      notify('ok', 'Balance adjustment recorded with audit trail.');
      setAdjAmount('');
      setAdjReason('');
      await fetchSection('balance_adjust');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleApiResponse(
        await fetch('/api/admin/payment-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: newAccLabel,
            address: newAccAddress,
            customQrDataUrl: newAccCustomQr || undefined,
          }),
        })
      );
      notify('ok', 'Receiving BEP20 wallet added.');
      setNewAccLabel('');
      setNewAccAddress('');
      setNewAccCustomQr('');
      await fetchSection('payment_accounts');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleGenerateSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await handleApiResponse(
        await fetch('/api/admin/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pair: sigPair,
            direction: sigDir,
            signalType: sigType,
            profitPercent: Number(sigPct),
            validityMinutes: Number(sigValidity),
            settleDelayMinutes: Number(sigSettle),
            customCode: sigCode.trim() || undefined,
            note: sigNote.trim() || undefined,
            targetIdentifier: sigTargetUser.trim() || undefined,
            isTest: sigIsTest,
          }),
        })
      );
      notify('ok', `Signal ${data.signal.signal_code} published.`);
      setSigCode('');
      setSigNote('');
      setSigTargetUser('');
      setSigIsTest(false);
      await fetchSection('signals');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleSaveSignalTiming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSignal) return;
    try {
      await handleApiResponse(
        await fetch('/api/admin/signals', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingSignal.id,
            startsAtMs: new Date(editingSignal.startsAtLocal).getTime(),
            expiresAtMs: new Date(editingSignal.expiresAtLocal).getTime(),
            profitPercent: Number(editingSignal.profitPercent),
          }),
        })
      );
      notify('ok', 'Signal timing & profit rate updated.');
      setEditingSignal(null);
      await fetchSection('signals');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleSaveSalaryLevels = async () => {
    try {
      await handleApiResponse(
        await fetch('/api/admin/team-salary', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ levels: editableLevels }),
        })
      );
      notify('ok', 'All 7 Sunday salary tiers updated.');
      await fetchSection('team_salary');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handlePaySalaries = async (userId?: number) => {
    try {
      const data = await handleApiResponse(
        await fetch('/api/admin/team-salary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userId ? { userId } : {}),
        })
      );
      notify(
        'ok',
        `Disbursed ${data.paidCount} Sunday salary payout(s) totaling $${formatUsdt(data.totalDisbursed)}.`
      );
      await fetchSection('team_salary');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleUploadResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resDataUrl || !resFileName) {
      notify('err', 'Please select a PDF or poster image file first.');
      return;
    }
    try {
      await handleApiResponse(
        await fetch('/api/admin/about-resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: resTitle,
            resourceType: resType,
            description: resDesc,
            fileName: resFileName,
            fileDataUrl: resDataUrl,
          }),
        })
      );
      notify('ok', 'Document / poster published to User About section.');
      setResTitle('');
      setResDesc('');
      setResFileName('');
      setResDataUrl('');
      await fetchSection('about_resources');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleExportWithdrawCsv = () => {
    if (!trackerData?.history.length) return;
    const header = 'ID,UID,Username,Gross,Fee,Net,BEP20,Status,TXID,Date\n';
    const rows = trackerData.history
      .map(
        (w) =>
          `${w.id},${w.uid},${w.username},${w.gross_amount},${w.fee_amount},${w.net_amount},${w.bep20_address},${w.status},${w.payout_tx_hash || ''},${new Date(w.created_at).toISOString()}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veltrix-withdraw-tracker-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSetDonationAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await handleApiResponse(
        await fetch('/api/admin/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'SET_ACCOUNT',
            label: donAccLabel,
            address: donAccAddress,
            customQrDataUrl: donAccCustomQr || undefined,
            deactivateOthers: true,
          }),
        })
      );
      notify('ok', 'Donation BEP20 receiving wallet & QR code updated.');
      setDonAccLabel('');
      setDonAccAddress('');
      setDonAccCustomQr('');
      await fetchSection('donations');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleToggleDonationAccount = async (accountId: number, isActive: boolean) => {
    try {
      await handleApiResponse(
        await fetch('/api/admin/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'TOGGLE_ACCOUNT',
            accountId,
            isActive,
          }),
        })
      );
      notify('ok', `Donation wallet ${isActive ? 'activated' : 'paused'}.`);
      await fetchSection('donations');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleDonationAction = async (
    donationId: number,
    action: 'VERIFY_BSCSCAN' | 'APPROVE' | 'REJECT'
  ) => {
    try {
      const note = donNoteMap[donationId] || '';
      const data = await handleApiResponse(
        await fetch('/api/admin/donations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            donationId,
            note: note || undefined,
          }),
        })
      );
      if (action === 'VERIFY_BSCSCAN') {
        notify(
          data.bscVerification?.verifiedOnChain ? 'ok' : 'err',
          data.bscVerification?.summary || 'BscScan donation verification finished.'
        );
      } else {
        notify('ok', `Donation #${donationId} ${action === 'APPROVE' ? 'approved' : 'rejected'}.`);
      }
      await fetchSection('donations');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    }
  };

  const handleDownloadBackup = async (format: 'db' | 'json' | 'csv', csvTable?: string) => {
    const key = csvTable ? `${format}-${csvTable}` : format;
    setDownloadingBackupFormat(key);
    try {
      const query = csvTable ? `format=csv&table=${csvTable}` : `format=${format}`;
      const res = await fetch(`/api/admin/backup?${query}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Backup download failed.');
      }
      const blob = await res.blob();
      const disp = res.headers.get('Content-Disposition') || '';
      const match = disp.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ||
        `veltrix-quant-backup-${Date.now()}.${format === 'db' ? 'db' : format === 'json' ? 'json' : 'csv'}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('ok', `Manual backup downloaded (${filename}).`);
      await fetchSection('backup');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    } finally {
      setDownloadingBackupFormat(null);
    }
  };

  const handleRotateAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdminPw(true);
    try {
      await handleApiResponse(
        await fetch('/api/admin/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentMasterPass1: curMasterPass1,
            currentMasterPass2: curMasterPass2,
            newPass1: newAdminPass1.trim() || undefined,
            newPass2: newAdminPass2.trim() || undefined,
          }),
        })
      );
      notify(
        'ok',
        `Master Admin credentials rotated successfully. Active session refreshed.`
      );
      setCurMasterPass1('');
      setCurMasterPass2('');
      setNewAdminPass1('');
      setNewAdminPass2('');
      await fetchSection('security_audit');
    } catch (err) {
      if (err instanceof Error) notify('err', err.message);
    } finally {
      setSavingAdminPw(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#090E14] dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#090E14]/95">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle admin navigation"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-[#111923] dark:text-slate-200 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#C6972C]/45 bg-[#0B1117] shrink-0">
              <img
                src="/assets/aistudio/image_3a25bab9.png"
                alt="Veltrix Quant"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                  Veltrix Quant Admin
                </span>
                <span className="rounded border border-[#C6972C]/40 bg-[#C6972C]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8F6510] dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] whitespace-nowrap shrink-0">
                  Master
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {adminName} · {lastUpdatedAt ? `Synced ${fmtDate(lastUpdatedAt)}` : 'On-demand load'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            <label htmlFor="admin-autorefresh" className="sr-only">
              Auto refresh interval
            </label>
            <select
              id="admin-autorefresh"
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              className="hidden sm:block h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#111923] dark:text-slate-200 dark:focus:border-[#D4AF37]"
            >
              <option value={0}>Auto-Refresh: Off</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
              <option value={120}>Every 2m</option>
            </select>

            <button
              type="button"
              onClick={() => fetchSection(activeSection)}
              disabled={loading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:border-[#C6972C]/50 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111923] dark:text-slate-200 dark:hover:border-[#D4AF37]/50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => handleLockOrLogout(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20 whitespace-nowrap shrink-0"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Lock Screen</span>
            </button>

            <button
              type="button"
              onClick={() => handleLockOrLogout(true)}
              aria-label="Sign out admin console"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-[#111923] dark:text-slate-300 dark:hover:text-white whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Navigation Rail (14 isolated sections) */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 top-[61px] z-40 block w-64 shadow-xl' : 'hidden'
          } lg:block lg:w-64 shrink-0 border-r border-slate-200/90 bg-white p-3 overflow-y-auto dark:border-white/[0.08] dark:bg-[#0E151D]`}
        >
          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Isolated Control Sections
          </p>
          <nav className="space-y-1">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(sec.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#0F172A] text-white font-semibold dark:bg-[#D4AF37] dark:text-[#0B1117]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 space-y-6">
          {banner && (
            <div
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs ${
                banner.type === 'ok'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/35 dark:text-emerald-200'
                  : 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss notification"
                className="ml-3 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {idleLockedNotice && (
            <div className="rounded-2xl border border-[#C6972C]/40 bg-white p-6 space-y-3 shadow-xs dark:border-[#D4AF37]/40 dark:bg-[#111923]">
              <div className="flex items-center gap-2 text-[#8F6510] dark:text-[#D4AF37]">
                <Lock className="h-5 w-5" />
                <h2 className="font-display text-base font-bold">
                  Session Auto-Locked After 2 Hours of Inactivity
                </h2>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                For treasury security, inactive admin sessions lock automatically after 120 minutes.
                Please re-authenticate through the main portal.
              </p>
              <Link
                href="/"
                className="inline-flex h-10 items-center rounded-lg bg-[#0F172A] px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117]"
              >
                Return to Sign In Portal
              </Link>
            </div>
          )}

          {/* 1. OVERVIEW */}
          {activeSection === 'overview' && overviewData && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Executive Treasury Overview
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time summary snapshot. Click any module on the left to load full tables on demand.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: 'Total Trading Capital',
                    val: `$${formatUsdt(overviewData.overview.totalCapital)}`,
                    sub: `${overviewData.overview.activeUsers} Active / ${overviewData.overview.blockedUsers} Blocked`,
                    tone: 'text-slate-900 dark:text-white',
                  },
                  {
                    label: 'User Profit Balances',
                    val: `$${formatUsdt(overviewData.overview.totalProfitBalance)}`,
                    sub: `Today Signal Profit: $${formatUsdt(overviewData.overview.signalProfitToday)}`,
                    tone: 'text-emerald-700 dark:text-[#10B981]',
                  },
                  {
                    label: 'Approved Deposits vs Paid WD',
                    val: `$${formatUsdt(overviewData.overview.totalApprovedDeposits)}`,
                    sub: `Paid Withdrawals: $${formatUsdt(overviewData.overview.totalPaidWithdrawals)}`,
                    tone: 'text-[#8F6510] dark:text-[#D4AF37]',
                  },
                  {
                    label: 'Net Treasury Flow',
                    val: `$${formatUsdt(overviewData.overview.netTreasuryFlow)}`,
                    sub: `${overviewData.overview.newDepositedUsers} New Deposited (≤3d)`,
                    tone: 'text-slate-900 dark:text-white',
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                    <p className={`font-mono-num mt-1.5 text-2xl font-bold ${c.tone}`}>{c.val}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{c.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('deposits')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pending Deposits Queue</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-[#8F6510] dark:text-[#D4AF37]">
                    {overviewData.overview.pendingDepositsCount} ($
                    {formatUsdt(overviewData.overview.pendingDepositsAmount)})
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Open Deposits →</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('withdraws')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pending Withdrawals (24/7)</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                    {overviewData.overview.pendingWithdrawalsCount} ($
                    {formatUsdt(overviewData.overview.pendingWithdrawalsNet)})
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Open Withdraw Queue →</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('food_allowance')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pending Food Allowances</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-emerald-700 dark:text-[#10B981]">
                    {overviewData.overview.pendingFoodAllowancesCount} ($
                    {formatUsdt(overviewData.overview.pendingFoodAllowancesAmount)})
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Open Food Allowance →</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('security_audit')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Chatbot Red Flags</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-red-600 dark:text-red-400">
                    {overviewData.overview.unreviewedRedFlags} Unreviewed
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Review Flags & Audit →</p>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setActiveSection('donations')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Community Donations ($1+ BEP20)</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-[#8F6510] dark:text-[#D4AF37]">
                    ${formatUsdt(overviewData.overview.totalApprovedDonations ?? 0)} Approved ·{' '}
                    {overviewData.overview.pendingDonationsCount ?? 0} Pending
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Configure QR Wallet &amp; View Donors →
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('backup')}
                  className="rounded-xl border border-slate-200/90 bg-white p-4 text-left shadow-xs hover:border-[#C6972C]/60 dark:border-white/[0.08] dark:bg-[#111923] dark:hover:border-[#D4AF37]/50"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">Disaster Recovery &amp; Snapshots</p>
                  <p className="font-display mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    Manual Database Backup (.DB / .JSON / .CSV)
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Open Manual Backup Vault →
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* 2. USERS & SIGNAL STATS */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Member Directory & Signal Activity
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tracks Capital, Profit, Today Profit, Lifetime Signals, and Missed Signals per member.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search UID, username, email..."
                      className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-900 shadow-xs placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#111923] dark:text-white dark:focus:border-[#D4AF37]"
                    />
                  </div>
                  <select
                    value={userFilter}
                    onChange={(e) =>
                      setUserFilter(e.target.value as 'ALL' | 'ACTIVE' | 'BLOCKED' | 'DEPOSITED')
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-xs focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#111923] dark:text-slate-200"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="BLOCKED">Blocked Only</option>
                    <option value="DEPOSITED">Deposited ($100+)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Sponsor</th>
                      <th className="px-4 py-3 text-right">Capital</th>
                      <th className="px-4 py-3 text-right">Profit</th>
                      <th className="px-4 py-3 text-right">Today Profit</th>
                      <th className="px-4 py-3 text-right">Lifetime Sig</th>
                      <th className="px-4 py-3 text-right">Missed Sig</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {u.full_name} <span className="text-slate-500 dark:text-slate-400">(@{u.username})</span>
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                            {u.uid} · {u.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {u.sponsor_username ? `@${u.sponsor_username}` : 'Root'}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-900 dark:text-white">
                          ${formatUsdt(u.capital_balance)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-emerald-700 dark:text-[#10B981]">
                          ${formatUsdt(u.profit_balance)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-[#8F6510] dark:text-[#D4AF37]">
                          +${formatUsdt(u.today_profit)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          {u.lifetime_signals}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-red-700 dark:text-red-300">
                          {u.missed_signals}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openUserDetail(u.id)}
                            className="rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-2.5 py-1 text-[11px] font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
                          >
                            Inspect / Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. NEW MEMBERS (3-DAY WINDOW) */}
          {activeSection === 'new_members' && newMembersData && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    New Members Separation (3-Day Window)
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Only Active Deposited new members receive the 9 PM Additional Signal (and their
                    direct sponsor receives 1 extra signal/day).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-white/10 dark:bg-[#111923]">
                  <button
                    type="button"
                    onClick={() => setNewMemberTab('ACTIVE')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      newMemberTab === 'ACTIVE'
                        ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#0B1117]'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Active Deposited ({newMembersData.activeNewMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMemberTab('UNFUNDED')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      newMemberTab === 'UNFUNDED'
                        ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#0B1117]'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    Unfunded Signups ({newMembersData.unfundedNewMembers.length})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Direct Sponsor (Grade A)</th>
                      <th className="px-4 py-3 text-right">Capital</th>
                      <th className="px-4 py-3">Qualified Window</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {(newMemberTab === 'ACTIVE'
                      ? newMembersData.activeNewMembers
                      : newMembersData.unfundedNewMembers
                    ).map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {m.full_name} (@{m.username})
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {m.uid} · {m.email}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {m.sponsor_username ? `@${m.sponsor_username} (${m.sponsor_uid})` : '—'}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-900 dark:text-white">
                          {'capital_balance' in m ? `$${formatUsdt(m.capital_balance)}` : '$0.00'}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                          {'first_deposit_at' in m
                            ? `Deposited ${fmtDate(m.first_deposit_at)} (Eligible for 9 PM Extra)`
                            : `Signed up ${fmtDate(m.created_at)} (Signals Locked)`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. BLOCK / UNBLOCK & IP LOCKS */}
          {activeSection === 'block_unblock' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Instant Member Block / Unblock
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Blocking increments the member token version and kicks active sessions immediately.
                </p>
                <div className="space-y-3">
                  <select
                    value={blockUserId}
                    onChange={(e) => setBlockUserId(Number(e.target.value))}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  >
                    <option value={0}>Select Member...</option>
                    {(usersData || []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.uid} · @{u.username} ({u.status})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Reason for block (min 3 chars)"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!blockUserId || blockReason.trim().length < 3}
                      onClick={() =>
                        patchUser(
                          blockUserId,
                          { action: 'BLOCK', reason: blockReason },
                          'User blocked & sessions terminated.'
                        )
                      }
                      className="h-10 flex-1 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Block & Kick Session
                    </button>
                    <button
                      type="button"
                      disabled={!blockUserId}
                      onClick={() =>
                        patchUser(blockUserId, { action: 'UNBLOCK' }, 'User account restored.')
                      }
                      className="h-10 flex-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                    >
                      Unblock Member
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  IP Brute-Force Locks (5 Failures → 30m Block)
                </h2>
                {ipLocksList.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No blocked or flagged IPs currently.</p>
                ) : (
                  <div className="space-y-2">
                    {ipLocksList.map((lock) => (
                      <div
                        key={lock.ip}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-white/[0.07] dark:bg-[#0B1117]"
                      >
                        <div>
                          <p className="font-mono-num font-semibold text-slate-900 dark:text-white">{lock.ip}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {lock.failed_attempts} attempts · {lock.reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleApiResponse(
                              await fetch('/api/admin/security', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'UNBLOCK_IP', ip: lock.ip }),
                              })
                            );
                            notify('ok', `IP ${lock.ip} unblocked.`);
                            fetchSection('block_unblock');
                          }}
                          className="rounded-lg border border-[#C6972C]/45 px-2.5 py-1 text-[11px] font-semibold text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                        >
                          Unblock IP
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. BALANCE ADJUST */}
          {activeSection === 'balance_adjust' && (
            <form
              onSubmit={handleBalanceAdjust}
              className="max-w-xl rounded-xl border border-slate-200/90 bg-white p-6 space-y-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
            >
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Manual Capital / Profit Balance Adjustment
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every adjustment writes a ledger transaction and immutable admin audit record.
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Member</label>
                <select
                  required
                  value={adjUserId}
                  onChange={(e) => setAdjUserId(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                >
                  <option value={0}>Select member...</option>
                  {(usersData || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.uid} · @{u.username} (Cap: ${formatUsdt(u.capital_balance)} / Prof: $
                      {formatUsdt(u.profit_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Wallet</label>
                  <select
                    value={adjTarget}
                    onChange={(e) => setAdjTarget(e.target.value as 'CAPITAL' | 'PROFIT')}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  >
                    <option value="PROFIT">Profit Balance</option>
                    <option value="CAPITAL">Trading Capital</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Operation</label>
                  <select
                    value={adjOp}
                    onChange={(e) => setAdjOp(e.target.value as 'ADD' | 'DEDUCT')}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  >
                    <option value="ADD">Add (+)</option>
                    <option value="DEDUCT">Deduct (-)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Amount (USDT)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjAmount}
                    onChange={(e) => setAdjAmount(e.target.value)}
                    className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Mandatory Audit Reason</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Manual treasury reconciliation"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={!adjUserId}
                className="h-10 rounded-lg bg-[#0F172A] px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
              >
                Commit Balance Adjustment
              </button>
            </form>
          )}

          {/* 6. DEPOSITS (BEP20 + BSCSCAN) */}
          {activeSection === 'deposits' && depositsList && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    BEP20 Deposits & BscScan Verification
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approval atomically credits Capital + 5% First Deposit Profit + 7% Direct
                    Sponsor Profit + 10% Food Allowance queue (at $300+).
                  </p>
                </div>
                <select
                  value={depositFilter}
                  onChange={(e) =>
                    setDepositFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-xs focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#111923] dark:text-slate-200"
                >
                  <option value="ALL">All Deposits</option>
                  <option value="PENDING">Pending Only</option>
                  <option value="APPROVED">Approved Only</option>
                  <option value="REJECTED">Rejected Only</option>
                </select>
              </div>

              <div className="space-y-3">
                {depositsList.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                            ${formatUsdt(d.amount)} USDT
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              d.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                                : d.status === 'REJECTED'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                            }`}
                          >
                            {d.status}
                          </span>
                          {d.amount >= 300 && (
                            <span className="rounded bg-[#C6972C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#8F6510] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                              10% Food Allowance ($
                              {formatUsdt(d.amount * 0.1)})
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
                          {d.full_name} (@{d.username} · {d.uid}) · {fmtDate(d.created_at)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono-num break-all">TXID: {d.tx_hash}</span>
                          <button
                            type="button"
                            onClick={() => copyText(d.tx_hash, `tx-${d.id}`)}
                            className="inline-flex items-center gap-1 text-[#8F6510] dark:text-[#D4AF37]"
                          >
                            {copiedId === `tx-${d.id}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Copy
                          </button>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          BscScan: {d.bsc_details || 'Not verified yet'}
                        </p>
                      </div>

                      {d.status === 'PENDING' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDepositAction(d.id, 'VERIFY_BSCSCAN')}
                            className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] font-medium text-slate-700 hover:border-[#C6972C]/60 dark:border-white/15 dark:bg-[#0B1117] dark:text-slate-200 dark:hover:border-[#D4AF37]/50"
                          >
                            Re-Verify BscScan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDepositAction(d.id, 'APPROVE')}
                            className="h-8 rounded-lg bg-emerald-600 px-3 text-[11px] font-semibold text-white hover:bg-emerald-700 dark:bg-[#10B981] dark:text-[#0B1117] dark:hover:bg-emerald-400"
                          >
                            Approve & Credit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDepositAction(d.id, 'REJECT')}
                            className="h-8 rounded-lg bg-red-600 px-3 text-[11px] font-semibold text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {d.status === 'PENDING' && (
                      <input
                        type="text"
                        value={depositNoteMap[d.id] || ''}
                        onChange={(e) =>
                          setDepositNoteMap((prev) => ({ ...prev, [d.id]: e.target.value }))
                        }
                        placeholder="Optional approval note / mandatory rejection reason..."
                        className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. COMPANY PAYMENT ACCOUNTS */}
          {activeSection === 'payment_accounts' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-3">
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Company Receiving BEP20 Wallets
                </h1>
                {(paymentAccounts || []).map((acc) => (
                  <div
                    key={acc.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {acc.qr_data_url && (
                        <img
                          src={acc.qr_data_url}
                          alt={acc.label}
                          className="h-16 w-16 rounded-lg border border-slate-200 bg-white p-1 shrink-0 dark:border-white/10"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{acc.label}</p>
                        <p className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300 break-all">
                          {acc.address}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {acc.is_active === 1 ? 'Active for Deposits' : 'Disabled'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        await handleApiResponse(
                          await fetch('/api/admin/payment-accounts', {
                            method: 'PATCH',
                            cache: 'no-store',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: acc.id, isActive: acc.is_active !== 1 }),
                          })
                        );
                        notify('ok', 'Wallet status updated.');
                        fetchSection('payment_accounts');
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 hover:border-[#C6972C] dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:border-[#D4AF37]"
                    >
                      {acc.is_active === 1 ? 'Disable' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleCreateAccount}
                className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-white p-5 space-y-3 h-fit shadow-xs dark:border-white/[0.11] dark:bg-[#111923]"
              >
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Add Receiving Wallet (BEP20)
                </h2>
                <input
                  type="text"
                  required
                  value={newAccLabel}
                  onChange={(e) => setNewAccLabel(e.target.value)}
                  placeholder="Wallet label (e.g. Treasury Vault #2)"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#0B1117] dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={newAccAddress}
                  onChange={(e) => setNewAccAddress(e.target.value)}
                  placeholder="BEP20 0x... address"
                  className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#0B1117] dark:text-white"
                />
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
                    Optional Custom QR Image (auto-generated if blank)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const r = new FileReader();
                      r.onload = () => setNewAccCustomQr(String(r.result || ''));
                      r.readAsDataURL(f);
                    }}
                    className="text-xs text-slate-600 dark:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="h-10 w-full rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
                >
                  Save Receiving Wallet
                </button>
              </form>
            </div>
          )}

          {/* 8. FOOD ALLOWANCE (10% FOR $300+) */}
          {activeSection === 'food_allowance' && foodItems && (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  10% Food Allowance Direct Payout Queue ($300+ Deposits)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sent directly to the member&apos;s external BEP20 wallet (never added to in-app balance).
                </p>
              </div>
              <div className="space-y-3">
                {foodItems.map((fa) => (
                  <div
                    key={fa.id}
                    className="rounded-xl border border-slate-200/90 bg-white p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        ${formatUsdt(fa.allowance_amount)} USDT Allowance{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          (10% of ${formatUsdt(fa.deposit_amount)})
                        </span>
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">
                        {fa.full_name} (@{fa.username} · {fa.uid})
                      </p>
                      <p className="font-mono-num mt-1 text-[11px] text-[#8F6510] dark:text-[#D4AF37]">
                        Target BEP20: {fa.current_user_bep20 || fa.bep20_address || 'Not bound yet'}
                      </p>
                      {fa.status === 'PAID' && (
                        <p className="font-mono-num mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                          Paid by {fa.paid_by} · TXID: {fa.payout_tx_hash}
                        </p>
                      )}
                    </div>

                    {fa.status === 'PENDING' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={foodTxMap[fa.id] || ''}
                          onChange={(e) =>
                            setFoodTxMap((prev) => ({ ...prev, [fa.id]: e.target.value }))
                          }
                          placeholder="Enter payout TXID (0x...)"
                          className="font-mono-num h-9 w-64 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await handleApiResponse(
                                await fetch('/api/admin/food-allowance', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: fa.id,
                                    txHash: foodTxMap[fa.id] || '',
                                  }),
                                })
                              );
                              notify('ok', 'Food allowance marked as paid.');
                              fetchSection('food_allowance');
                            } catch (err) {
                              if (err instanceof Error) notify('err', err.message);
                            }
                          }}
                          className="h-9 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-[#10B981] dark:text-[#0B1117]"
                        >
                          Mark Paid
                        </button>
                      </div>
                    ) : (
                      <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                        PAID
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. WITHDRAW QUEUE */}
          {activeSection === 'withdraws' && pendingWithdraws && (
            <div className="space-y-4">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  24/7 Pending Withdrawal Queue
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Profit-only withdrawals. Rejecting automatically refunds gross amount back to
                  the user&apos;s Profit Balance.
                </p>
              </div>
              {pendingWithdraws.length === 0 ? (
                <div className="rounded-xl border border-slate-200/90 bg-white p-6 text-xs text-slate-500 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] dark:text-slate-400">
                  No pending withdrawal requests right now.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingWithdraws.map((w) => (
                    <div
                      key={w.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono-num text-sm font-bold text-slate-900 dark:text-white">
                            Net Payout: ${formatUsdt(w.net_amount)} USDT{' '}
                            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                              (Gross ${formatUsdt(w.gross_amount)} − {w.fee_percent}% fee)
                            </span>
                          </p>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {w.full_name} (@{w.username} · {w.uid}) · {fmtDate(w.created_at)}
                          </p>
                          <p className="font-mono-num mt-1 text-[11px] text-[#8F6510] dark:text-[#D4AF37]">
                            BEP20: {w.bep20_address}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={wdTxMap[w.id] || ''}
                            onChange={(e) =>
                              setWdTxMap((prev) => ({ ...prev, [w.id]: e.target.value }))
                            }
                            placeholder="Payout TXID (0x...)"
                            className="font-mono-num h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleApiResponse(
                                  await fetch('/api/admin/withdraws', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: w.id,
                                      action: 'APPROVE',
                                      payoutTxHash: wdTxMap[w.id] || '',
                                    }),
                                  })
                                );
                                notify('ok', `Withdrawal #${w.id} paid.`);
                                fetchSection('withdraws');
                              } catch (err) {
                                if (err instanceof Error) notify('err', err.message);
                              }
                            }}
                            className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 dark:bg-[#10B981] dark:text-[#0B1117]"
                          >
                            Approve & Pay
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={wdRejectMap[w.id] || ''}
                            onChange={(e) =>
                              setWdRejectMap((prev) => ({ ...prev, [w.id]: e.target.value }))
                            }
                            placeholder="Rejection reason (auto-refunds)"
                            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleApiResponse(
                                  await fetch('/api/admin/withdraws', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: w.id,
                                      action: 'REJECT',
                                      rejectReason: wdRejectMap[w.id] || '',
                                    }),
                                  })
                                );
                                notify('ok', `Withdrawal #${w.id} rejected & refunded.`);
                                fetchSection('withdraws');
                              } catch (err) {
                                if (err instanceof Error) notify('err', err.message);
                              }
                            }}
                            className="h-9 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 10. WITHDRAW TRACKER */}
          {activeSection === 'withdraw_tracker' && trackerData && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Withdrawal Ledger & User-Wise Tracker
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Shows cumulative payouts per member plus complete chronological history.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportWithdrawCsv}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3.5 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3 text-right">Paid Count</th>
                      <th className="px-4 py-3 text-right">Total Gross Paid</th>
                      <th className="px-4 py-3 text-right">Total Net Paid</th>
                      <th className="px-4 py-3">Last Paid At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {trackerData.perUserSummary.map((s) => (
                      <tr key={s.user_id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {s.full_name} (@{s.username} · {s.uid})
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {s.paid_count}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-900 dark:text-white">
                          ${formatUsdt(s.total_gross_paid)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-emerald-700 dark:text-[#10B981]">
                          ${formatUsdt(s.total_net_paid)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{fmtDate(s.last_paid_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[780px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3 text-right">Gross</th>
                      <th className="px-4 py-3 text-right">Net</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">TXID / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {trackerData.history.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{fmtDate(w.created_at)}</td>
                        <td className="px-4 py-2.5 text-slate-900 dark:text-white">
                          @{w.username} ({w.uid})
                        </td>
                        <td className="font-mono-num px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">
                          ${formatUsdt(w.gross_amount)}
                        </td>
                        <td className="font-mono-num px-4 py-2.5 text-right text-emerald-700 dark:text-[#10B981]">
                          ${formatUsdt(w.net_amount)}
                        </td>
                        <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{w.status}</td>
                        <td className="font-mono-num px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {w.payout_tx_hash || w.reject_reason || 'Pending'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 11. SIGNAL GENERATOR */}
          {activeSection === 'signals' && signalsData && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <form
                onSubmit={handleGenerateSignal}
                className="xl:col-span-5 rounded-xl border border-slate-200/90 bg-white p-5 space-y-3 h-fit shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
              >
                <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Publish Quantitative Signal
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Defaults: Regular {signalsData.defaults.regularTimes} · Extra{' '}
                  {signalsData.defaults.extraTime} ({signalsData.defaults.timezone}).
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Trading Pair</label>
                    <select
                      value={sigPair}
                      onChange={(e) => setSigPair(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                    >
                      <option value="BTC/USDT">BTC/USDT</option>
                      <option value="ETH/USDT">ETH/USDT</option>
                      <option value="BNB/USDT">BNB/USDT</option>
                      <option value="SOL/USDT">SOL/USDT</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Direction</label>
                    <select
                      value={sigDir}
                      onChange={(e) => setSigDir(e.target.value as 'LONG' | 'SHORT')}
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                    >
                      <option value="LONG">LONG</option>
                      <option value="SHORT">SHORT</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Signal Cohort Type</label>
                  <select
                    value={sigType}
                    onChange={(e) => setSigType(e.target.value as 'REGULAR' | 'ADDITIONAL')}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  >
                    <option value="REGULAR">REGULAR (All Active Deposited Members)</option>
                    <option value="ADDITIONAL">
                      ADDITIONAL (New Members ≤3d + Direct Sponsor 1/day)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Yield %</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={sigPct}
                      onChange={(e) => setSigPct(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Valid (min)</label>
                    <input
                      type="number"
                      required
                      value={sigValidity}
                      onChange={(e) => setSigValidity(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Settle (min)</label>
                    <input
                      type="number"
                      required
                      value={sigSettle}
                      onChange={(e) => setSigSettle(e.target.value)}
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                    />
                  </div>
                </div>

                <input
                  type="text"
                  value={sigCode}
                  onChange={(e) => setSigCode(e.target.value.toUpperCase())}
                  placeholder="Optional Custom Code (auto-generated if blank)"
                  className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Personal Target Member (Optional UID or @username)
                  </label>
                  <input
                    type="text"
                    value={sigTargetUser}
                    onChange={(e) => setSigTargetUser(e.target.value)}
                    placeholder="e.g. trader_ali or VQ-1002 — locks code to 1 account"
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  />
                </div>
                <input
                  type="text"
                  value={sigNote}
                  onChange={(e) => setSigNote(e.target.value)}
                  placeholder="Optional desk session note"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <label className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 cursor-pointer dark:border-white/10 dark:bg-[#0B1117] dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={sigIsTest}
                    onChange={(e) => setSigIsTest(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-[#B4831D] dark:accent-[#D4AF37]"
                  />
                  <span>Test Signal (Admin QA — Hidden from User Windows)</span>
                </label>

                <button
                  type="submit"
                  className="h-10 w-full rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
                >
                  Generate & Publish Signal
                </button>
              </form>

              <div className="xl:col-span-7 space-y-3">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Signal Broadcast History & Timing Controls
                </h2>
                {signalsData.signals.map((s) => {
                  const groupMsg = s.signal_code;
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-num text-sm font-bold text-[#8F6510] dark:text-[#D4AF37]">
                            {s.signal_code}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {s.pair} · {s.direction}
                          </span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/[0.06] dark:text-slate-200">
                            {s.signal_type}
                          </span>
                          {s.is_test === 1 && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                              TEST
                            </span>
                          )}
                          {s.target_username && (
                            <span className="rounded bg-[#C6972C]/15 px-2 py-0.5 text-[10px] font-semibold text-[#8F6510] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]">
                              Locked to @{s.target_username} ({s.target_uid})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyText(groupMsg, `sig-${s.id}`)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#C6972C]/45 px-2.5 text-[11px] font-semibold text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                          >
                            {copiedId === `sig-${s.id}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copiedId === `sig-${s.id}` ? 'Copied' : 'Copy Code'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingSignal({
                                id: s.id,
                                startsAtLocal: toDatetimeLocalValue(s.starts_at),
                                expiresAtLocal: toDatetimeLocalValue(s.expires_at),
                                profitPercent: String(s.profit_percent),
                              })
                            }
                            className="h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200"
                          >
                            Edit Timing
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Yield: <strong className="text-emerald-700 dark:text-[#10B981]">{s.profit_percent}%</strong> ·
                        Window: {fmtDate(s.starts_at)} → {fmtDate(s.expires_at)} · Claims:{' '}
                        <strong className="text-slate-900 dark:text-white">{s.claims_count}</strong> ($
                        {formatUsdt(s.total_profit_allocated)})
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 12. TEAM & DYNAMIC SUNDAY SALARY */}
          {activeSection === 'team_salary' && teamSalaryData && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Dynamic Sunday Salary Config (Levels 1–7) & Payouts
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Current Week: <strong className="text-[#8F6510] dark:text-[#D4AF37]">{teamSalaryData.currentWeek}</strong>.
                    Configure % vs Fixed $ payouts, Grade thresholds, and Team-Matched Cap.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSalaryLevels}
                    className="h-9 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-4 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]"
                  >
                    Save Level Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePaySalaries()}
                    className="h-9 rounded-lg bg-[#0F172A] px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117]"
                  >
                    Pay All Sunday Salaries ({teamSalaryData.currentWeek})
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5">Lvl</th>
                      <th className="px-3 py-2.5">Grade Name</th>
                      <th className="px-3 py-2.5">Min Direct (A)</th>
                      <th className="px-3 py-2.5">Min Team (ABC)</th>
                      <th className="px-3 py-2.5">Min Own ($)</th>
                      <th className="px-3 py-2.5">Calc Mode</th>
                      <th className="px-3 py-2.5">Rate (% or $)</th>
                      <th className="px-3 py-2.5">Team-Matched Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {editableLevels.map((lvl, idx) => (
                      <tr key={lvl.level}>
                        <td className="font-mono-num px-3 py-2 font-bold text-[#8F6510] dark:text-[#D4AF37]">
                          L{lvl.level}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={lvl.name}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, name: e.target.value };
                              setEditableLevels(next);
                            }}
                            className="h-8 w-48 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-white/15 dark:bg-[#0B1117] dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={lvl.minDirectActive}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, minDirectActive: Number(e.target.value) };
                              setEditableLevels(next);
                            }}
                            className="font-mono-num h-8 w-20 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={lvl.minTeamActive}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, minTeamActive: Number(e.target.value) };
                              setEditableLevels(next);
                            }}
                            className="font-mono-num h-8 w-20 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            value={lvl.minOwnDeposit}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, minOwnDeposit: Number(e.target.value) };
                              setEditableLevels(next);
                            }}
                            className="font-mono-num h-8 w-24 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={lvl.calcMode}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = {
                                ...lvl,
                                calcMode: e.target.value as 'PERCENTAGE' | 'FIXED',
                              };
                              setEditableLevels(next);
                            }}
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                          >
                            <option value="PERCENTAGE">% Deposit</option>
                            <option value="FIXED">Fixed $</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={lvl.rateValue}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, rateValue: Number(e.target.value) };
                              setEditableLevels(next);
                            }}
                            className="font-mono-num h-8 w-20 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-emerald-700 dark:border-white/10 dark:bg-[#0B1117] dark:text-[#10B981]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={lvl.useTeamMatchedCap}
                            onChange={(e) => {
                              const next = [...editableLevels];
                              next[idx] = { ...lvl, useTeamMatchedCap: e.target.checked };
                              setEditableLevels(next);
                            }}
                            aria-label={`Team matched cap level ${lvl.level}`}
                            className="h-4 w-4 accent-[#B4831D] dark:accent-[#D4AF37]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <table className="w-full min-w-[880px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Leader</th>
                      <th className="px-4 py-3 text-right">Own Cap</th>
                      <th className="px-4 py-3 text-right">A / B / C Active</th>
                      <th className="px-4 py-3 text-right">Inactive</th>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3 text-right">Est. Salary</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                    {teamSalaryData.leaders.map((l) => (
                      <tr key={l.userId} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-slate-900 dark:text-white">
                          {l.fullName} (@{l.username} · {l.uid})
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-700 dark:text-slate-200">
                          ${formatUsdt(l.ownCapital)}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {l.gradeAActive} / {l.gradeBActive} / {l.gradeCActive}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {l.inactiveTeamCount}
                        </td>
                        <td className="px-4 py-3 text-[#8F6510] dark:text-[#D4AF37]">
                          {l.qualifiedLevel > 0 ? `L${l.qualifiedLevel} ${l.qualifiedLevelName}` : '—'}
                        </td>
                        <td className="font-mono-num px-4 py-3 text-right text-emerald-700 dark:text-[#10B981]">
                          ${formatUsdt(l.estimatedSalary)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {l.paidThisWeek ? (
                            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Paid</span>
                          ) : l.estimatedSalary > 0 ? (
                            <button
                              type="button"
                              onClick={() => handlePaySalaries(l.userId)}
                              className="rounded border border-[#C6972C]/45 px-2.5 py-1 text-[11px] font-semibold text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">Not Qualified</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 13. ABOUT PDF & POSTERS */}
          {activeSection === 'about_resources' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <form
                onSubmit={handleUploadResource}
                className="lg:col-span-5 rounded-xl border border-slate-200/90 bg-white p-5 space-y-3 h-fit shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
              >
                <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Upload Official PDF or Rules Poster
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Uploaded files appear immediately inside the Member Dashboard → About section.
                </p>
                <input
                  type="text"
                  required
                  value={resTitle}
                  onChange={(e) => setResTitle(e.target.value)}
                  placeholder="Title (e.g. Veltrix Quant Rules & Salary Poster)"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <select
                  value={resType}
                  onChange={(e) => setResType(e.target.value as 'PDF' | 'POSTER')}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                >
                  <option value="POSTER">Rules Poster Image (PNG / JPG / WebP)</option>
                  <option value="PDF">Policy Document (PDF)</option>
                </select>
                <input
                  type="text"
                  value={resDesc}
                  onChange={(e) => setResDesc(e.target.value)}
                  placeholder="Short description for members"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <div>
                  <label className="mb-1 block text-[11px] text-slate-500 dark:text-slate-400">
                    Select File (Max 3 MB)
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setResFileName(f.name);
                      const r = new FileReader();
                      r.onload = () => setResDataUrl(String(r.result || ''));
                      r.readAsDataURL(f);
                    }}
                    className="text-xs text-slate-700 dark:text-slate-300"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117]"
                >
                  <Upload className="h-4 w-4" />
                  Publish to User About Section
                </button>
              </form>

              <div className="lg:col-span-7 space-y-3">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Published Member Resources ({aboutResources?.length || 0})
                </h2>
                {(aboutResources || []).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {r.resource_type === 'POSTER' ? (
                        <img
                          src={r.file_data_url}
                          alt={r.title}
                          className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0 dark:border-white/10"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-[#C6972C]/35 bg-[#C6972C]/10 text-[#8F6510] dark:border-[#D4AF37]/30 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] shrink-0">
                          <FileText className="h-6 w-6" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{r.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {r.resource_type} · {r.file_name} · Uploaded by {r.uploaded_by}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await handleApiResponse(
                          await fetch(`/api/admin/about-resources?id=${r.id}`, {
                            method: 'DELETE',
                          })
                        );
                        notify('ok', 'Resource deleted.');
                        fetchSection('about_resources');
                      }}
                      aria-label={`Delete ${r.title}`}
                      className="h-8 rounded-lg border border-red-300 px-2.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 14. DONATIONS ($1+ BEP20, AUTO QR & DONOR LEDGER) */}
          {activeSection === 'donations' && donationsData && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Community Donations ($1+ USDT BEP20 &amp; Auto QR)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure the official BEP20 donation wallet (QR generates automatically) and track
                  exactly which members donated, when, and how much. Isolated from trading capital.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Approved</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-[#8F6510] dark:text-[#D4AF37]">
                    ${formatUsdt(donationsData.summary.totalApprovedAmount)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pending Review</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">
                    {donationsData.summary.pendingCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Approved Entries</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-emerald-700 dark:text-[#10B981]">
                    {donationsData.summary.approvedCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Unique Donors</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    {donationsData.summary.uniqueDonors}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <form
                  onSubmit={handleSetDonationAccount}
                  className="lg:col-span-5 rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                >
                  <div>
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Set Donation BEP20 Address &amp; Auto QR
                    </h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Master Admin only. Entering a BEP20 address automatically builds its scannable
                      QR code for the User Donation Wallet.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Donation Fund Label
                    </label>
                    <input
                      type="text"
                      required
                      value={donAccLabel}
                      onChange={(e) => setDonAccLabel(e.target.value)}
                      placeholder="Veltrix Community Relief Fund (BEP20)"
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/15 dark:bg-[#0B1117] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      USDT BEP20 Receiving Address (0x...)
                    </label>
                    <input
                      type="text"
                      required
                      value={donAccAddress}
                      onChange={(e) => setDonAccAddress(e.target.value)}
                      placeholder="0x..."
                      className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/15 dark:bg-[#0B1117] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Optional Custom QR Image (Auto-generated if left blank)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setDonAccCustomQr(String(reader.result || ''));
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:rounded-lg file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-xs file:font-medium dark:file:border-white/15 dark:file:bg-[#0B1117] dark:file:text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="h-10 w-full rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
                  >
                    Save Donation Wallet &amp; Generate QR
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Configured Donation Wallets ({donationsData.accounts.length})
                  </h2>
                  {donationsData.accounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                    >
                      {acc.qr_data_url && (
                        <img
                          src={acc.qr_data_url}
                          alt={acc.label}
                          className="h-24 w-24 rounded-lg border border-slate-200 bg-white p-1 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {acc.label}
                          </span>
                          <span
                            className={`font-semibold ${
                              acc.is_active === 1
                                ? 'text-emerald-700 dark:text-[#10B981]'
                                : 'text-slate-400'
                            }`}
                          >
                            {acc.is_active === 1 ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </div>
                        <p className="font-mono-num break-all rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-[#8F6510] dark:border-white/5 dark:bg-[#090E14] dark:text-[#D4AF37]">
                          {acc.address}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => copyText(acc.address, `don-acc-${acc.id}`)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5"
                          >
                            {copiedId === `don-acc-${acc.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-[#10B981]" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            <span>{copiedId === `don-acc-${acc.id}` ? 'Copied' : 'Copy Address'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleDonationAccount(acc.id, acc.is_active !== 1)
                            }
                            className="h-8 rounded-lg border border-[#C6972C]/45 px-2.5 text-[11px] font-medium text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                          >
                            {acc.is_active === 1 ? 'Pause Wallet' : 'Activate Wallet'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Donor Ledger */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Member Donor Ledger ({donationsData.donations.length})
                  </h2>
                  <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#111923]">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setDonationFilter(st)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          donationFilter === st
                            ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#0B1117]'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {donationsData.donations.length === 0 ? (
                  <p className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-xs text-slate-500 dark:border-white/[0.08] dark:bg-[#111923] dark:text-slate-400">
                    No donations matching filter &ldquo;{donationFilter}&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {donationsData.donations.map((dn) => (
                      <div
                        key={dn.id}
                        className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {dn.full_name}
                            </span>{' '}
                            <span className="font-mono-num text-slate-500 dark:text-slate-400">
                              ({dn.uid} · @{dn.username})
                            </span>
                            {dn.note && (
                              <span className="ml-2 text-slate-600 dark:text-slate-300">
                                — &ldquo;{dn.note}&rdquo;
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-num text-sm font-bold text-[#8F6510] dark:text-[#D4AF37]">
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
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-mono-num break-all">TXID: {dn.tx_hash}</span>
                          <span>{fmtDate(dn.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          BscScan: {dn.bsc_details || 'Pending verification'}
                        </p>

                        {dn.status === 'PENDING' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={donNoteMap[dn.id] || ''}
                              onChange={(e) =>
                                setDonNoteMap((prev) => ({ ...prev, [dn.id]: e.target.value }))
                              }
                              placeholder="Review note / rejection reason..."
                              className="h-8 flex-1 min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleDonationAction(dn.id, 'VERIFY_BSCSCAN')}
                              className="h-8 rounded-lg border border-[#C6972C]/45 px-3 text-xs font-medium text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                            >
                              Re-Verify BscScan
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDonationAction(dn.id, 'APPROVE')}
                              className="h-8 rounded-lg bg-[#0F172A] px-3 text-xs font-semibold text-white dark:bg-[#D4AF37] dark:text-[#0B1117]"
                            >
                              Approve Donation
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDonationAction(dn.id, 'REJECT')}
                              className="h-8 rounded-lg border border-red-300 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 15. MANUAL DATABASE BACKUP & DISASTER RECOVERY */}
          {activeSection === 'backup' && backupMeta && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Manual Data Backup &amp; Disaster Recovery
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Take an immediate manual snapshot at any time before hosting migrations, server
                  updates, or schema changes so member balances and records are never lost.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Database File</p>
                  <p className="font-mono-num mt-1 truncate text-base font-bold text-slate-900 dark:text-white">
                    {backupMeta.dbFileName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    SQLite WAL Engine
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Main DB Size</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-[#8F6510] dark:text-[#D4AF37]">
                    {(backupMeta.dbSizeBytes / 1024).toFixed(1)} KB
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    WAL Buffer: {(backupMeta.walSizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tracked Tables</p>
                  <p className="font-mono-num mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    {backupMeta.tables.length} Tables
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Total Rows:{' '}
                    {backupMeta.tables.reduce((acc, t) => acc + t.rowCount, 0).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Last Modified</p>
                  <p className="font-mono-num mt-1 text-base font-bold text-emerald-700 dark:text-[#10B981]">
                    {fmtDate(backupMeta.lastModifiedAt)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {backupMeta.recentBackups.length} manual exports logged
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Full Platform Backup Snapshots
                  </h2>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/[0.06] dark:bg-[#090E14] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          1. Full Binary SQLite Snapshot (.db)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Flushes WAL transactions cleanly via VACUUM INTO for exact server restore.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={downloadingBackupFormat === 'db'}
                        onClick={() => handleDownloadBackup('db')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0F172A] px-3.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-[#D4AF37] dark:text-[#0B1117]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>
                          {downloadingBackupFormat === 'db' ? 'Preparing...' : 'Download .DB'}
                        </span>
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 dark:border-white/[0.06] dark:bg-[#090E14] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white">
                          2. Full Operational JSON Archive (.json)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Human-readable backup of all 18 tables (password/PIN hashes omitted for
                          safety).
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={downloadingBackupFormat === 'json'}
                        onClick={() => handleDownloadBackup('json')}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3.5 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 disabled:opacity-40 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>
                          {downloadingBackupFormat === 'json' ? 'Exporting...' : 'Download .JSON'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      3. Targeted Spreadsheet Exports (.CSV)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['users', 'Users CSV'],
                          ['deposits', 'Deposits CSV'],
                          ['withdrawals', 'Withdrawals CSV'],
                          ['donations', 'Donations CSV'],
                          ['ledger', 'Ledger CSV'],
                        ] as const
                      ).map(([tbl, lbl]) => (
                        <button
                          key={tbl}
                          type="button"
                          disabled={downloadingBackupFormat === `csv-${tbl}`}
                          onClick={() => handleDownloadBackup('csv', tbl)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-[#090E14] dark:text-slate-200 dark:hover:bg-white/5"
                        >
                          <Download className="h-3 w-3" />
                          <span>{lbl}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] space-y-4">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Live Table Inventory &amp; Backup Audit
                  </h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs">
                    {backupMeta.tables.map((t) => (
                      <div
                        key={t.name}
                        className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2 dark:border-white/[0.06] dark:bg-[#090E14]"
                      >
                        <span className="truncate text-slate-600 dark:text-slate-300">{t.name}</span>
                        <span className="font-mono-num ml-2 font-bold text-slate-900 dark:text-white">
                          {t.rowCount}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Recent Manual Backups ({backupMeta.recentBackups.length})
                    </p>
                    {backupMeta.recentBackups.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No manual backups taken yet.
                      </p>
                    ) : (
                      <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 text-xs dark:divide-white/[0.06]">
                        {backupMeta.recentBackups.map((b) => (
                          <div key={b.id} className="flex items-center justify-between py-2">
                            <div>
                              <span className="font-medium text-slate-900 dark:text-white">
                                {b.admin_name}
                              </span>{' '}
                              <span className="font-mono-num text-[11px] text-[#8F6510] dark:text-[#D4AF37]">
                                {b.details_json}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {fmtDate(b.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 16. SECURITY, AUDIT LOGS, CHATBOT RED FLAGS, SYSTEM SETTINGS & ADMIN PASSWORDS */}
          {activeSection === 'security_audit' && securityData && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Audit Logs, Chatbot Red Flags, Settings &amp; Passwords
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Full accountability trail for Master Admin actions, platform parameters, and
                    credential rotation.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-white/10 dark:bg-[#111923]">
                  {(
                    [
                      ['AUDIT', `Admin Audit (${securityData.auditLogs.length})`],
                      ['FLAGS', `Red Flags (${securityData.chatFlags.length})`],
                      ['IP', `IP Locks (${securityData.ipLocks.length})`],
                      ['SETTINGS', 'Platform Settings'],
                      ['PASSWORDS', 'Admin Passwords'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSecSubTab(id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        secSubTab === id
                          ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#0B1117]'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {secSubTab === 'AUDIT' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <table className="w-full min-w-[780px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-white/[0.08] dark:bg-[#0E151D] dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Admin</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Target</th>
                        <th className="px-4 py-3">Details</th>
                        <th className="px-4 py-3">IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                      {securityData.auditLogs.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{fmtDate(a.created_at)}</td>
                          <td className="px-4 py-2.5 text-slate-900 dark:text-white">
                            {a.admin_name}{' '}
                            <span className="text-[10px] text-[#8F6510] dark:text-[#D4AF37]">({a.admin_role})</span>
                          </td>
                          <td className="font-mono-num px-4 py-2.5 text-emerald-700 dark:text-emerald-300">{a.action}</td>
                          <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                            {a.target_type} #{a.target_id}
                          </td>
                          <td className="px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate">
                            {a.details_json || '—'}
                          </td>
                          <td className="font-mono-num px-4 py-2.5 text-slate-500 dark:text-slate-400">
                            {a.ip_address}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {secSubTab === 'FLAGS' && (
                <div className="space-y-3">
                  {securityData.chatFlags.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-xl border border-red-200 bg-white p-4 flex flex-wrap items-start justify-between gap-4 shadow-xs dark:border-red-500/25 dark:bg-[#111923]"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2 text-xs">
                          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <span className="font-semibold text-slate-900 dark:text-white">
                            @{f.username || 'unknown'} ({f.uid || 'N/A'})
                          </span>
                          <span className="text-red-700 dark:text-red-300">· {f.flag_reason}</span>
                          <span className="text-slate-500 dark:text-slate-400">· {fmtDate(f.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200">
                          <strong>User:</strong> &ldquo;{f.message}&rdquo;
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <strong>Bot Reply:</strong> {f.reply}
                        </p>
                      </div>
                      {f.reviewed === 0 ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await handleApiResponse(
                              await fetch('/api/admin/security', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'REVIEW_CHAT_FLAG', logId: f.id }),
                              })
                            );
                            notify('ok', 'Red flag marked as reviewed.');
                            fetchSection('security_audit');
                          }}
                          className="h-8 rounded-lg bg-[#0F172A] px-3 text-xs font-semibold text-white dark:bg-[#D4AF37] dark:text-[#0B1117]"
                        >
                          Mark Reviewed
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Reviewed</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {secSubTab === 'IP' && (
                <div className="space-y-2">
                  {securityData.ipLocks.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No IP lockouts recorded.</p>
                  ) : (
                    securityData.ipLocks.map((l) => (
                      <div
                        key={l.ip}
                        className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-4 text-xs shadow-xs dark:border-white/[0.08] dark:bg-[#111923]"
                      >
                        <div>
                          <p className="font-mono-num font-bold text-slate-900 dark:text-white">{l.ip}</p>
                          <p className="text-slate-500 dark:text-slate-400">
                            {l.failed_attempts} attempts · {l.reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleApiResponse(
                              await fetch('/api/admin/security', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'UNBLOCK_IP', ip: l.ip }),
                              })
                            );
                            notify('ok', `IP ${l.ip} unblocked.`);
                            fetchSection('security_audit');
                          }}
                          className="h-8 rounded-lg border border-[#C6972C]/45 px-3 text-xs font-medium text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                        >
                          Unblock IP
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {secSubTab === 'SETTINGS' && settingsMap && (
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-xs dark:border-white/[0.11] dark:bg-[#111923]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/[0.08]">
                    <div>
                      <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Core Platform Rules, Telegram Links &amp; Timings
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        All saved settings persist permanently in SQLite and reflect live across
                        the member app.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingSettings}
                      onClick={async () => {
                        setSavingSettings(true);
                        try {
                          const data = await handleApiResponse(
                            await fetch('/api/admin/settings', {
                              method: 'PUT',
                              cache: 'no-store',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ settings: settingsMap }),
                            })
                          );
                          if (data.settings) {
                            setSettingsMap(data.settings);
                          }
                          notify('ok', 'Platform settings saved permanently.');
                          await fetchSection('security_audit');
                        } catch (err) {
                          if (err instanceof Error) notify('err', err.message);
                        } finally {
                          setSavingSettings(false);
                        }
                      }}
                      className="h-9 rounded-lg bg-[#0F172A] px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
                    >
                      {savingSettings ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>

                  {/* Telegram Community & Announcement Section */}
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-3 dark:border-white/[0.09] dark:bg-[#0B1018]">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                      Telegram Signal Links &amp; Live Announcement
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label
                          htmlFor="setting-telegram-group"
                          className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Official Telegram Signal Group Link
                        </label>
                        <input
                          id="setting-telegram-group"
                          type="text"
                          value={settingsMap.telegram_group_url || ''}
                          onChange={(e) =>
                            setSettingsMap((prev) =>
                              prev ? { ...prev, telegram_group_url: e.target.value } : prev
                            )
                          }
                          placeholder="https://t.me/VeltrixQuantSignals"
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="setting-telegram-channel"
                          className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Official Telegram Channel Link
                        </label>
                        <input
                          id="setting-telegram-channel"
                          type="text"
                          value={settingsMap.telegram_channel_url || ''}
                          onChange={(e) =>
                            setSettingsMap((prev) =>
                              prev ? { ...prev, telegram_channel_url: e.target.value } : prev
                            )
                          }
                          placeholder="https://t.me/VeltrixQuantChannel"
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="setting-support-contact"
                          className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                        >
                          Official Support Contact
                        </label>
                        <input
                          id="setting-support-contact"
                          type="text"
                          value={settingsMap.support_contact || ''}
                          onChange={(e) =>
                            setSettingsMap((prev) =>
                              prev ? { ...prev, support_contact: e.target.value } : prev
                            )
                          }
                          placeholder="+1 (800) 555-0199 or @support"
                          className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="setting-announcement"
                        className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
                      >
                        Dashboard Announcement Banner
                      </label>
                      <textarea
                        id="setting-announcement"
                        rows={2}
                        value={settingsMap.announcement_text || ''}
                        onChange={(e) =>
                          setSettingsMap((prev) =>
                            prev ? { ...prev, announcement_text: e.target.value } : prev
                          )
                        }
                        placeholder="Announcement shown at top of Member Dashboard..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  {/* Numeric Rules & Timings Grid */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(settingsMap)
                      .filter(([key]) => !HIDDEN_SETTINGS.has(key))
                      .map(([key, val]) => {
                        const meta = SETTING_LABELS[key];
                        return (
                          <div key={key}>
                            <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                              {meta ? meta.label : key}
                            </label>
                            <input
                              type="text"
                              value={val}
                              onChange={(e) =>
                                setSettingsMap((prev) =>
                                  prev ? { ...prev, [key]: e.target.value } : prev
                                )
                              }
                              className="font-mono-num h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#0B1117] dark:text-white dark:focus:border-[#D4AF37]"
                            />
                            {meta?.hint && (
                              <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                {meta.hint}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {secSubTab === 'PASSWORDS' && (
                <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-5 shadow-xs dark:border-white/[0.11] dark:bg-[#111923]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#C6972C]/40 bg-[#C6972C]/10 text-[#8F6510] dark:border-[#D4AF37]/35 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] shrink-0">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                          Rotate Master Admin Passwords (Stage-1 &amp; Stage-2)
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Requires verifying Master Admin Pass #1 &amp; Pass #2. Rotating any
                          password immediately invalidates prior session tokens.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPwFields(!showPwFields)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      {showPwFields ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPwFields ? 'Hide Passwords' : 'Show Passwords'}</span>
                    </button>
                  </div>

                  <form onSubmit={handleRotateAdminPassword} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="cur-master-p1"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Current Master Pass #1 (Login)
                          </label>
                          <input
                            id="cur-master-p1"
                            type={showPwFields ? 'text' : 'password'}
                            required
                            value={curMasterPass1}
                            onChange={(e) => setCurMasterPass1(e.target.value)}
                            placeholder="Verify current Stage-1 password"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="cur-master-p2"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Current Master Pass #2 (Panel Lock)
                          </label>
                          <input
                            id="cur-master-p2"
                            type={showPwFields ? 'text' : 'password'}
                            required
                            value={curMasterPass2}
                            onChange={(e) => setCurMasterPass2(e.target.value)}
                            placeholder="Verify current Stage-2 security password"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="new-admin-p1"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            New Stage-1 Password (Leave blank to keep current)
                          </label>
                          <input
                            id="new-admin-p1"
                            type={showPwFields ? 'text' : 'password'}
                            value={newAdminPass1}
                            onChange={(e) => setNewAdminPass1(e.target.value)}
                            placeholder="8+ chars, upper/lower/digit/symbol"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="new-admin-p2"
                            className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            New Stage-2 Security Password (Leave blank to keep current)
                          </label>
                          <input
                            id="new-admin-p2"
                            type={showPwFields ? 'text' : 'password'}
                            value={newAdminPass2}
                            onChange={(e) => setNewAdminPass2(e.target.value)}
                            placeholder="8+ chars, upper/lower/digit/symbol"
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#B4831D] focus:outline-none dark:border-white/10 dark:bg-[#0B1117] dark:text-white dark:focus:border-[#D4AF37]"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingAdminPw}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0F172A] px-5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-[#D4AF37] dark:text-[#0B1117] dark:hover:bg-[#E5C354]"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span>
                          {savingAdminPw ? 'Updating Credentials...' : 'Rotate Admin Passwords'}
                        </span>
                      </button>
                    </form>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* User Detail / Edit Slide-Over Modal */}
      {selectedUserDetail && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm dark:bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-label="Inspect and manage member"
        >
          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-[#F4F6FA] p-6 space-y-6 dark:border-white/10 dark:bg-[#0E151D]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {selectedUserDetail.user.full_name} (@{selectedUserDetail.user.username})
                </h2>
                <p className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                  {selectedUserDetail.user.uid} · Team A/B/C Active:{' '}
                  {selectedUserDetail.team.stats.gradeAActive}/
                  {selectedUserDetail.team.stats.gradeBActive}/
                  {selectedUserDetail.team.stats.gradeCActive} (Inactive:{' '}
                  {selectedUserDetail.team.inactiveCount})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserDetail(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300"
              >
                Close
              </button>
            </div>

            {/* Edit Full Name & Email */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                Edit Profile (Invalidates Active User Token)
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Full Name"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email Address"
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  patchUser(
                    selectedUserDetail.user.id,
                    { action: 'EDIT_PROFILE', fullName: editFullName, email: editEmail },
                    'Profile updated & audited.'
                  )
                }
                className="h-8 rounded-lg bg-[#0F172A] px-3.5 text-xs font-semibold text-white dark:bg-[#D4AF37] dark:text-[#0B1117]"
              >
                Save Name & Email
              </button>
            </div>

            {/* BEP20 Wallet Override / Unlock & Reset Password / PIN */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">BEP20 Wallet Control</h3>
                <input
                  type="text"
                  value={walletOverrideVal}
                  onChange={(e) => setWalletOverrideVal(e.target.value)}
                  placeholder="0x... BEP20 address"
                  className="font-mono-num h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      patchUser(
                        selectedUserDetail.user.id,
                        { action: 'UPDATE_WALLET', bep20Address: walletOverrideVal },
                        'User BEP20 wallet updated & locked.'
                      )
                    }
                    className="h-8 flex-1 rounded-lg bg-[#0F172A] text-[11px] font-semibold text-white dark:bg-[#D4AF37] dark:text-[#0B1117]"
                  >
                    Set Wallet
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      patchUser(
                        selectedUserDetail.user.id,
                        { action: 'UPDATE_WALLET', unlockOnly: true },
                        'User BEP20 wallet unlocked.'
                      )
                    }
                    className="h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200"
                  >
                    Unlock
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Reset Password / PIN</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPwVal}
                    onChange={(e) => setResetPwVal(e.target.value)}
                    placeholder="New strong password"
                    className="h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchUser(
                        selectedUserDetail.user.id,
                        { action: 'RESET_PASSWORD', newPassword: resetPwVal },
                        'User password reset.'
                      )
                    }
                    className="h-8 rounded-lg border border-[#C6972C]/45 px-2.5 text-[11px] font-medium text-[#8F6510] dark:border-[#D4AF37]/40 dark:text-[#D4AF37]"
                  >
                    Set PW
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPinVal}
                    onChange={(e) => setResetPinVal(e.target.value)}
                    placeholder="New 4-6 digit PIN (or blank)"
                    className="font-mono-num h-8 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patchUser(
                        selectedUserDetail.user.id,
                        { action: 'RESET_PIN', newPin: resetPinVal || undefined },
                        'Withdraw PIN updated.'
                      )
                    }
                    className="h-8 rounded-lg border border-slate-200 px-2.5 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Ledger */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-2 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Recent Member Ledger</h3>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 dark:divide-white/[0.06]">
                {selectedUserDetail.ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <p className="text-slate-700 dark:text-slate-200">{l.note || l.type}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {l.wallet_target} · {fmtDate(l.created_at)}
                      </p>
                    </div>
                    <span
                      className={`font-mono-num font-semibold ${
                        l.amount >= 0 ? 'text-emerald-700 dark:text-[#10B981]' : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      {l.amount >= 0 ? '+' : ''}
                      {formatUsdt(l.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Signal Timing Modal */}
      {editingSignal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm dark:bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-label="Edit signal timing"
        >
          <form
            onSubmit={handleSaveSignalTiming}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xl dark:border-white/10 dark:bg-[#111923]"
          >
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Edit Signal Timing & Yield
            </h3>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Starts At</label>
              <input
                type="datetime-local"
                required
                value={editingSignal.startsAtLocal}
                onChange={(e) =>
                  setEditingSignal({ ...editingSignal, startsAtLocal: e.target.value })
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Expires At</label>
              <input
                type="datetime-local"
                required
                value={editingSignal.expiresAtLocal}
                onChange={(e) =>
                  setEditingSignal({ ...editingSignal, expiresAtLocal: e.target.value })
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Profit %</label>
              <input
                type="number"
                step="0.01"
                required
                value={editingSignal.profitPercent}
                onChange={(e) =>
                  setEditingSignal({ ...editingSignal, profitPercent: e.target.value })
                }
                className="font-mono-num h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 dark:border-white/10 dark:bg-[#0B1117] dark:text-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSignal(null)}
                className="h-9 flex-1 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 flex-1 rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#0B1117]"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
