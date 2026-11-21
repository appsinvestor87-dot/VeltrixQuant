'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { ThemeToggle } from './ThemeToggle';
import { validateStrongPassword } from '@/lib/quant-rules';
import { getPlatformFaqs } from '@/lib/faqs';

interface AuthPortalProps {
  initialAdminStage2?: boolean;
  adminDisplayName?: string;
}

const inputCls =
  'h-11 w-full rounded-lg border border-slate-300 bg-slate-50/70 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#B4831D] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B4831D]/15 dark:border-white/[0.15] dark:bg-[#0B1018] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37] dark:focus:bg-[#0B1018] dark:focus:ring-[#D4AF37]/20';

const labelCls = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';

export function AuthPortal({ initialAdminStage2 = false, adminDisplayName = '' }: AuthPortalProps) {
  const [mode, setMode] = useState<'SIGNIN' | 'SIGNUP'>('SIGNIN');
  const [adminStage2, setAdminStage2] = useState(initialAdminStage2);
  const [adminLabel, setAdminLabel] = useState(adminDisplayName);

  // Sign In state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Stage-2 Admin Security Password
  const [securityPassword, setSecurityPassword] = useState('');
  const [showSecPw, setShowSecPw] = useState(false);

  // Sign Up state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [policyModalTab, setPolicyModalTab] = useState<'TERMS' | 'PRIVACY' | 'FAQS'>('TERMS');
  const [openAuthFaqId, setOpenAuthFaqId] = useState<string>('faq-deposit-tiers');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwStrength = validateStrongPassword(signupPassword);
  const pwMismatch = confirmPassword.length > 0 && signupPassword !== confirmPassword;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to sign in.');
        setLoading(false);
        return;
      }
      if (data.stage === 'ADMIN_STAGE_2') {
        setAdminLabel(data.displayName || 'Administrator');
        setAdminStage2(true);
        setLoginPassword('');
        setLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-unlock', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ securityPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid admin security password.');
        setLoading(false);
        return;
      }
      window.location.href = '/admin';
    } catch {
      setError('Unable to verify security password.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError('You must accept the Veltrix Quant Terms, Policies & Privacy Policy to continue.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!pwStrength.valid) {
      setError(pwStrength.reason || 'Choose a stronger password.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          email,
          password: signupPassword,
          confirmPassword,
          referralCode,
          acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        setLoading(false);
        return;
      }
      window.location.href = '/dashboard';
    } catch {
      setError('Network error during registration.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#090E14] dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Bar Contract: Brand wordmark — concise nav anchors — Theme & Install App CTA */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md dark:border-white/[0.08] dark:bg-[#090E14]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[#C6972C]/45 bg-[#0B1117] shadow-xs">
              <img
                src="/assets/aistudio/image_3a25bab9.png"
                alt="Veltrix Quant"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Veltrix Quant
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="whitespace-nowrap shrink-0">BEP20 USDT Treasury</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="whitespace-nowrap shrink-0">30m Signal Execution</span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="whitespace-nowrap shrink-0">Sunday Leadership Salary</span>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Main Balanced Split Layout */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:py-12">
        {/* Left Institutional Overview */}
        <section className="lg:col-span-5 space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#C6972C]/50 bg-[#0B1117] shadow-md">
              <img
                src="/assets/aistudio/image_3a25bab9.png"
                alt="Veltrix Quant Brand Emblem"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#8F6510] dark:text-[#D4AF37]">
                Institutional Quantitative Desk
              </p>
              <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl text-balance">
                Disciplined USDT Signal Execution &amp; Team Treasury
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
            Veltrix Quant pairs timed BEP20 signal execution with transparent ledger accounting,
            compounding returns on Trading Capital plus Profit Balance, and structured Grade A/B/C
            leadership rewards.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.11] dark:bg-[#111923]">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Deposit Network
              </p>
              <p className="font-mono-num mt-1 text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                USDT BEP20
              </p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.11] dark:bg-[#111923]">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Signal Yield
              </p>
              <p className="font-mono-num mt-1 text-sm font-bold text-emerald-700 dark:text-[#10B981] whitespace-nowrap">
                0.80% / Signal
              </p>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.11] dark:bg-[#111923] sm:col-span-1">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Daily Windows
              </p>
              <p className="font-mono-num mt-1 text-sm font-bold text-[#8F6510] dark:text-[#D4AF37] whitespace-nowrap">
                4 · 6 · 8 PM
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white/80 p-4 text-xs leading-relaxed text-slate-600 shadow-xs dark:border-white/[0.11] dark:bg-[#111923]/90 dark:text-slate-300 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900 dark:text-white">
                Core Operating &amp; Privacy Protections
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPolicyModalTab('PRIVACY');
                    setShowTermsModal(true);
                  }}
                  className="text-[11px] font-semibold text-[#8F6510] underline underline-offset-2 hover:text-[#6B4A0A] dark:text-[#D4AF37] dark:hover:text-[#E5C354]"
                >
                  Privacy &amp; Fund Safety
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPolicyModalTab('FAQS');
                    setShowTermsModal(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8F6510] underline underline-offset-2 hover:text-[#6B4A0A] dark:text-[#D4AF37] dark:hover:text-[#E5C354]"
                >
                  <HelpCircle className="h-3 w-3" />
                  <span>FAQs</span>
                </button>
              </div>
            </div>
            <p>
              Invite-only registration with verified active member referral codes · Fixed
              $100–$5,000 deposit tiers · 10% Direct Food Allowance at $300+ · 15-day first
              withdrawal unlock with 24/7 profit-only cashout &amp; encrypted ledger protection.
            </p>
          </div>
        </section>

        {/* Right Auth Card (first on mobile so Sign In / Sign Up is immediately usable) */}
        <section className="order-first lg:order-last lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-white/[0.12] dark:bg-[#111923] dark:shadow-2xl dark:shadow-black/60 sm:p-8"
          >
            {adminStage2 ? (
              <form onSubmit={handleAdminUnlock} className="space-y-5">
                <div className="flex items-center gap-3.5 border-b border-slate-200 pb-4 dark:border-white/[0.08]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C6972C]/45 bg-[#C6972C]/10 text-[#8F6510] dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      Security Verification Required
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {adminLabel} · Enter Secondary Panel Password
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="admin-security-pw" className={labelCls}>
                    Admin Panel Password
                  </label>
                  <div className="relative">
                    <input
                      id="admin-security-pw"
                      type={showSecPw ? 'text' : 'password'}
                      required
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      placeholder="Enter secondary security password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecPw(!showSecPw)}
                      aria-label={showSecPw ? 'Hide security password' : 'Show security password'}
                      className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      {showSecPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminStage2(false);
                      setSecurityPassword('');
                      setError(null);
                    }}
                    className="h-11 flex-1 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-11 flex-[2] items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{loading ? 'Unlocking...' : 'Unlock Console'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Clean Segmented Mode Switcher */}
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-slate-200/90 bg-slate-100 p-1 dark:border-white/[0.08] dark:bg-[#090E14]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('SIGNIN');
                      setError(null);
                    }}
                    className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'SIGNIN'
                        ? 'bg-[#0F172A] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#090E14]'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('SIGNUP');
                      setError(null);
                    }}
                    className={`h-10 rounded-lg text-sm font-semibold transition-all ${
                      mode === 'SIGNUP'
                        ? 'bg-[#0F172A] text-white shadow-xs dark:bg-[#D4AF37] dark:text-[#090E14]'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {error && (
                  <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                  </div>
                )}

                {mode === 'SIGNIN' ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="mb-2">
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        Member Sign In
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Access your BEP20 capital wallet, live trading terminal, and team dashboard.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="signin-identifier" className={labelCls}>
                        Username or Email
                      </label>
                      <input
                        id="signin-identifier"
                        type="text"
                        required
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="Enter your username or email"
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label htmlFor="signin-password" className={labelCls}>
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="signin-password"
                          type={showLoginPw ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="Enter your password"
                          className={`${inputCls} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPw(!showLoginPw)}
                          aria-label={showLoginPw ? 'Hide password' : 'Show password'}
                          className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        >
                          {showLoginPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                    >
                      <span>{loading ? 'Signing In...' : 'Sign In to Veltrix Quant'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    {/* Sample Member Accounts for quick user evaluation */}
                    <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08]">
                      <p className="mb-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Quick Evaluation Member Accounts
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: 'Mature ($2k)', user: 'veteran_sara' },
                          { label: 'New 3d ($500)', user: 'trader_ali' },
                          { label: 'Locked ($0)', user: 'fresh_bilal' },
                        ].map((acc) => (
                          <button
                            key={acc.user}
                            type="button"
                            onClick={() => {
                              setIdentifier(acc.user);
                              setLoginPassword('Veltrix@123');
                            }}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold text-slate-700 transition-colors hover:border-[#B4831D] hover:bg-white dark:border-white/10 dark:bg-[#090E14] dark:text-slate-300 dark:hover:border-[#D4AF37]/50 dark:hover:text-white"
                          >
                            {acc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="border-b border-slate-200 pb-3 dark:border-white/[0.08]">
                      <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                        Create Member Account
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Invite-only registration. Unique username &amp; email lock permanently upon
                        creation.
                      </p>
                    </div>

                    {/* Section 1: Member Identity */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                        1. Member Identity
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="signup-fullname" className={labelCls}>
                            Full Name
                          </label>
                          <input
                            id="signup-fullname"
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label htmlFor="signup-username" className={labelCls}>
                            Unique Username
                          </label>
                          <input
                            id="signup-username"
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choose a unique username"
                            className={inputCls}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Contact & Invite Code */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                        2. Verified Email &amp; Sponsor Invite
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="signup-email" className={labelCls}>
                            Valid Email Address
                          </label>
                          <input
                            id="signup-email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email address"
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label htmlFor="signup-referral" className={labelCls}>
                            Active Referral Code
                          </label>
                          <div className="relative">
                            <input
                              id="signup-referral"
                              type="text"
                              required
                              value={referralCode}
                              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                              placeholder="Sponsor invite code"
                              className={`${inputCls} font-mono-num pr-10 uppercase placeholder:normal-case`}
                            />
                            <UserCheck className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Account Security */}
                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8F6510] dark:text-[#D4AF37]">
                        3. Strong Security Password
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="signup-password" className={labelCls}>
                            Password
                          </label>
                          <div className="relative">
                            <input
                              id="signup-password"
                              type={showSignupPw ? 'text' : 'password'}
                              required
                              value={signupPassword}
                              onChange={(e) => setSignupPassword(e.target.value)}
                              placeholder="8+ chars (A-Z, a-z, 0-9, @)"
                              className={`${inputCls} pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowSignupPw(!showSignupPw)}
                              aria-label={showSignupPw ? 'Hide signup password' : 'Show signup password'}
                              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                              {showSignupPw ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div>
                          <label htmlFor="signup-confirm" className={labelCls}>
                            Confirm Password
                          </label>
                          <div className="relative">
                            <input
                              id="signup-confirm"
                              type={showConfirmPw ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              className={`${inputCls} pr-11 ${
                                pwMismatch
                                  ? 'border-red-400 focus:border-red-500 dark:border-red-500/60'
                                  : ''
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPw(!showConfirmPw)}
                              aria-label={
                                showConfirmPw ? 'Hide confirm password' : 'Show confirm password'
                              }
                              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                              {showConfirmPw ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Unified Password Feedback Bar */}
                      {(signupPassword.length > 0 || pwMismatch) && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-white/[0.06] dark:bg-[#090E14]">
                          <div className="flex flex-1 items-center gap-2.5 min-w-[180px]">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                              <div
                                className={`h-full transition-all ${
                                  pwStrength.score >= 5
                                    ? 'bg-emerald-600 dark:bg-[#10B981]'
                                    : pwStrength.score >= 3
                                      ? 'bg-amber-500'
                                      : 'bg-red-500'
                                }`}
                                style={{ width: `${(pwStrength.score / 5) * 100}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {pwStrength.valid ? 'Strong password' : 'Needs A-Z, a-z, 0-9 & symbol'}
                            </span>
                          </div>
                          {pwMismatch && (
                            <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                              Passwords do not match
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Terms & Privacy Policy Box */}
                    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-white/[0.11] dark:bg-[#0B1018]">
                      <input
                        id="signup-terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white accent-[#0F172A] dark:border-white/25 dark:bg-[#0B1018] dark:accent-[#D4AF37]"
                      />
                      <label
                        htmlFor="signup-terms"
                        className="text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                      >
                        I confirm my email and username are accurate and accept the{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setPolicyModalTab('TERMS');
                            setShowTermsModal(true);
                          }}
                          className="font-semibold text-[#8F6510] underline underline-offset-2 hover:text-[#6B4A0A] dark:text-[#D4AF37] dark:hover:text-[#E5C354]"
                        >
                          Terms &amp; Operating Policies
                        </button>{' '}
                        and{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setPolicyModalTab('PRIVACY');
                            setShowTermsModal(true);
                          }}
                          className="font-semibold text-[#8F6510] underline underline-offset-2 hover:text-[#6B4A0A] dark:text-[#D4AF37] dark:hover:text-[#E5C354]"
                        >
                          Privacy &amp; Fund Protection Policy
                        </button>
                        .
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
                    </button>
                  </form>
                )}
              </>
            )}
          </motion.div>
        </section>
      </main>

      {/* Terms & Privacy Policy Preview Modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Veltrix Quant Terms & Privacy Policy"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/[0.14] dark:bg-[#111923]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-[#8F6510] dark:text-[#D4AF37]" />
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Veltrix Quant Terms &amp; Privacy Charter
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-[#0B1018]">
              <button
                type="button"
                onClick={() => setPolicyModalTab('TERMS')}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                  policyModalTab === 'TERMS'
                    ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Terms &amp; Policies
              </button>
              <button
                type="button"
                onClick={() => setPolicyModalTab('PRIVACY')}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                  policyModalTab === 'PRIVACY'
                    ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                Privacy &amp; Safety
              </button>
              <button
                type="button"
                onClick={() => setPolicyModalTab('FAQS')}
                className={`h-9 rounded-lg text-xs font-semibold transition-colors ${
                  policyModalTab === 'FAQS'
                    ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                FAQs
              </button>
            </div>

            {policyModalTab === 'TERMS' ? (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  <strong className="text-slate-900 dark:text-white">1. Invite-Only Access:</strong>{' '}
                  Registration requires a valid referral code from an active deposited ($100+)
                  Veltrix Quant member. Email and username are locked after signup.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">2. USDT (BEP20) Treasury:</strong>{' '}
                  Fixed deposit tiers ($100, $200, $300, $500, $1,000, $2,000, $3,000, $5,000)
                  verified via BscScan TXID. First deposit grants a 5% Profit Balance bonus.
                  Deposits of $300+ qualify for a 10% Food Allowance sent directly to your bound
                  BEP20 address.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">3. Signal Execution:</strong>{' '}
                  Signals unlock once your deposit is active. Yield (0.80% default) compounds on
                  (Trading Capital + Profit Balance), valid for 30 minutes and settled after 20
                  minutes.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">
                    4. Capital &amp; Withdrawal Rules:
                  </strong>{' '}
                  Deposited Trading Capital cannot be withdrawn. Profit Balance unlocks permanently
                  15 days after your first approved deposit (24/7 access, 1 withdrawal per day,
                  minimum $10 USDT, configurable fee). BEP20 wallet binding is one-time.
                </p>
              </div>
            ) : policyModalTab === 'PRIVACY' ? (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  <strong className="text-slate-900 dark:text-white">
                    1. Member Funds &amp; Ledger Integrity:
                  </strong>{' '}
                  Every USDT BEP20 deposit, signal yield, referral commission, and withdrawal is
                  recorded in an atomic double-entry ledger with immutable before/after balances
                  and verified TXID audit trails.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">
                    2. One-Time Wallet Lock &amp; Withdraw PIN:
                  </strong>{' '}
                  Your personal BEP20 payout wallet binds permanently once set, protected by your
                  salted-hashed Withdraw PIN so unauthorized address swaps cannot happen.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">
                    3. Data Security &amp; Encryption:
                  </strong>{' '}
                  Passwords and PINs are hashed with bcrypt, sessions use signed HttpOnly cookies,
                  and repeated failed logins trigger automatic IP lockout protection.
                </p>
                <p>
                  <strong className="text-slate-900 dark:text-white">
                    4. Zero Third-Party Ads &amp; Manual Disaster Backups:
                  </strong>{' '}
                  Veltrix Quant runs zero third-party ad scripts or data brokers. Member profiles,
                  balances, and transaction histories are never sold or shared externally, and
                  Master Admin maintains manual database backups to prevent any data loss.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-xs">
                {getPlatformFaqs().map((faq) => {
                  const isOpen = openAuthFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-xl border border-slate-200/90 bg-slate-50/70 dark:border-white/[0.1] dark:bg-[#0B1018]"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenAuthFaqId(isOpen ? '' : faq.id)}
                        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left font-semibold text-slate-900 dark:text-white"
                      >
                        <span>{faq.question}</span>
                        <span className="text-[#8F6510] dark:text-[#D4AF37] shrink-0">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="border-t border-slate-200/80 px-3.5 py-2.5 leading-relaxed text-slate-600 dark:border-white/[0.08] dark:text-slate-300">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setAcceptedTerms(true);
                setShowTermsModal(false);
              }}
              className="mt-5 h-10 w-full rounded-lg bg-[#0F172A] text-xs font-semibold text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
            >
              Accept Terms &amp; Privacy Policy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
