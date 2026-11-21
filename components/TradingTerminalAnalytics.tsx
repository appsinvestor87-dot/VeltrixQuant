'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Send,
  TrendingUp,
} from 'lucide-react';
import { formatUsdt } from '@/lib/quant-rules';
import { computeFixedScheduleWindow } from '@/lib/signal-schedule';

interface ClaimRecord {
  id: number;
  signal_id: number;
  signal_code: string;
  pair: string;
  direction: string;
  signal_type: 'REGULAR' | 'ADDITIONAL';
  base_capital: number;
  base_profit: number;
  total_base: number;
  profit_percent: number;
  expected_profit: number;
  status: 'PENDING' | 'SETTLED';
  claimed_at: number;
  settled_at: number | null;
}

interface TradingTerminalProps {
  onClaimSuccess: () => void;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  label: string;
}

const PAIR_SEEDS: Record<string, { base: number; vol: string; change: number }> = {
  'BTC/USDT': { base: 94280.5, vol: '1.84B', change: 2.42 },
  'ETH/USDT': { base: 3418.2, vol: '842.6M', change: 1.87 },
  'BNB/USDT': { base: 642.4, vol: '318.9M', change: 3.14 },
};

function generateDeterministicCandles(basePrice: number, timeframe: string): Candle[] {
  const tfMult =
    timeframe === '1m' ? 0.0012 : timeframe === '5m' ? 0.0024 : timeframe === '15m' ? 0.004 : 0.007;
  const candles: Candle[] = [];
  let price = basePrice * 0.988;

  for (let i = 0; i < 36; i++) {
    const wave = Math.sin(i * 0.55) * 0.55 + Math.cos(i * 0.27) * 0.45;
    const drift = 0.00045;
    const open = price;
    const delta = open * tfMult * (wave + drift * 2);
    const close = open + delta;
    const wickUp = Math.abs(open * tfMult * (0.35 + ((i * 7) % 5) * 0.12));
    const wickDown = Math.abs(open * tfMult * (0.3 + ((i * 3) % 5) * 0.11));
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;
    const volume = 30 + ((i * 19) % 70);
    candles.push({
      open,
      high,
      low,
      close,
      volume,
      label: `${String((10 + i) % 24).padStart(2, '0')}:00`,
    });
    price = close;
  }
  return candles;
}

function formatScheduleRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hours > 0) {
    return `${hours}h ${String(min).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  }
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TradingTerminalAnalytics({ onClaimSuccess }: TradingTerminalProps) {
  const [pair, setPair] = useState<'BTC/USDT' | 'ETH/USDT' | 'BNB/USDT'>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h'>('15m');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [tickOffset, setTickOffset] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [loading, setLoading] = useState(true);
  const [isDepositActive, setIsDepositActive] = useState(false);
  const [isExtraEligible, setIsExtraEligible] = useState(false);
  const [capitalBalance, setCapitalBalance] = useState(0);
  const [profitBalance, setProfitBalance] = useState(0);
  const [compoundingBase, setCompoundingBase] = useState(0);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [telegramGroupUrl, setTelegramGroupUrl] = useState('');
  const [telegramChannelUrl, setTelegramChannelUrl] = useState('');
  const [schedule, setSchedule] = useState({
    regularTimes: '16:00, 18:00, 20:00',
    extraTime: '21:00',
    timezone: 'Asia/Karachi',
    profitPercent: 0.8,
    validityMinutes: 30,
  });

  const [signalCode, setSignalCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadSignalsData = async () => {
    try {
      const res = await fetch('/api/user/signals', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setIsDepositActive(Boolean(data.isDepositActive));
      setIsExtraEligible(Boolean(data.isExtraEligible));
      setCapitalBalance(Number(data.capitalBalance || 0));
      setProfitBalance(Number(data.profitBalance || 0));
      setCompoundingBase(Number(data.compoundingBase || 0));
      setClaims(data.claims || []);
      setTelegramGroupUrl(data.telegramGroupUrl || '');
      setTelegramChannelUrl(data.telegramChannelUrl || '');
      if (data.schedule) {
        setSchedule({
          regularTimes: data.schedule.regularTimes || '16:00, 18:00, 20:00',
          extraTime: data.schedule.extraTime || '21:00',
          timezone: data.schedule.timezone || 'Asia/Karachi',
          profitPercent: Number(data.schedule.profitPercent ?? 0.8),
          validityMinutes: Number(data.schedule.validityMinutes ?? 30),
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignalsData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
      setTickOffset((prev) => {
        const next = prev === 0 ? 0.0004 : prev > 0 ? -0.0003 : 0.0002;
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const seed = PAIR_SEEDS[pair];
  const candles = useMemo(() => {
    const base = generateDeterministicCandles(seed.base, timeframe);
    const last = base[base.length - 1];
    if (last) {
      const updatedClose = last.close * (1 + tickOffset);
      base[base.length - 1] = {
        ...last,
        close: updatedClose,
        high: Math.max(last.high, updatedClose),
        low: Math.min(last.low, updatedClose),
      };
    }
    return base;
  }, [seed.base, timeframe, tickOffset]);

  const latestCandle = candles[candles.length - 1];
  const inspectedCandle = hoverIdx !== null ? candles[hoverIdx] : latestCandle;
  const minLow = Math.min(...candles.map((c) => c.low));
  const maxHigh = Math.max(...candles.map((c) => c.high));
  const priceSpan = Math.max(0.01, maxHigh - minLow);

  const orderBook = useMemo(() => {
    const mid = latestCandle.close;
    const step = mid * 0.00035;
    const asks = Array.from({ length: 5 }, (_, i) => ({
      price: mid + step * (5 - i),
      size: (1.24 + (4 - i) * 0.63).toFixed(2),
      depth: 25 + (4 - i) * 14,
    }));
    const bids = Array.from({ length: 5 }, (_, i) => ({
      price: mid - step * (i + 1),
      size: (1.42 + i * 0.58).toFixed(2),
      depth: 28 + i * 13,
    }));
    return { asks, bids };
  }, [latestCandle.close]);

  const handleExecuteSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/user/signals', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: 'err', text: data.error || 'Signal execution rejected.' });
        setSubmitting(false);
        return;
      }
      setFeedback({
        type: 'ok',
        text: `Signal ${data.claim.signalCode} executed on $${formatUsdt(data.claim.totalBase)}. Expected profit +$${formatUsdt(data.claim.expectedProfit)} is queued for processing.`,
      });
      setSignalCode('');
      await loadSignalsData();
      onClaimSuccess();
    } catch {
      setFeedback({ type: 'err', text: 'Network error executing signal.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Silent background refresh while claims are processing (never shows any settlement timer)
  const hasPendingClaims = claims.some((c) => c.status === 'PENDING');
  useEffect(() => {
    if (!hasPendingClaims) return;
    const poll = setInterval(() => {
      loadSignalsData();
      onClaimSuccess();
    }, 25_000);
    return () => clearInterval(poll);
  }, [hasPendingClaims, onClaimSuccess]);

  const fixedStatus = useMemo(
    () =>
      computeFixedScheduleWindow({
        regularTimes: schedule.regularTimes,
        extraTime: schedule.extraTime,
        timezone: schedule.timezone,
        validityMinutes: schedule.validityMinutes,
        includeExtra: isExtraEligible,
        nowMs,
      }),
    [schedule.regularTimes, schedule.extraTime, schedule.timezone, schedule.validityMinutes, isExtraEligible, nowMs]
  );

  return (
    <div className="space-y-6">
      {/* Market Telemetry Header */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/[0.08] dark:bg-[#111923] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-white/[0.07]">
          <div className="flex flex-wrap items-center gap-2">
            {(['BTC/USDT', 'ETH/USDT', 'BNB/USDT'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPair(p)}
                className={`min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  pair === p
                    ? 'bg-[#0F172A] text-white dark:bg-[#D4AF37] dark:text-[#090E14]'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-[#090E14] dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Mark Price</span>
              <p className="font-mono-num mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                ${latestCandle.close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">24h Change</span>
              <p className="font-mono-num mt-0.5 text-sm font-semibold text-emerald-700 dark:text-[#10B981]">
                +{seed.change.toFixed(2)}%
              </p>
            </div>
            <div className="hidden sm:block">
              <span className="text-slate-500 dark:text-slate-400">24h High / Low</span>
              <p className="font-mono-num mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                ${maxHigh.toFixed(2)} / ${minLow.toFixed(2)}
              </p>
            </div>
            <div className="hidden md:block">
              <span className="text-slate-500 dark:text-slate-400">24h Volume</span>
              <p className="font-mono-num mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                {seed.vol} USDT
              </p>
            </div>
          </div>
        </div>

        {/* Main Trading Terminal Split: Candlestick + Order Book + Execution */}
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Chart Column */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-[#090E14]">
                {(['1m', '5m', '15m', '1h'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      timeframe === tf
                        ? 'bg-white text-[#8F6510] shadow-xs dark:bg-[#16202C] dark:text-[#D4AF37]'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <div className="font-mono-num flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span>O: {inspectedCandle.open.toFixed(2)}</span>
                <span>H: {inspectedCandle.high.toFixed(2)}</span>
                <span>L: {inspectedCandle.low.toFixed(2)}</span>
                <span
                  className={
                    inspectedCandle.close >= inspectedCandle.open
                      ? 'font-semibold text-emerald-700 dark:text-[#10B981]'
                      : 'font-semibold text-red-600 dark:text-red-400'
                  }
                >
                  C: {inspectedCandle.close.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-white/[0.07] dark:bg-[#090E14]">
              <svg
                viewBox="0 0 720 280"
                className="h-60 w-full select-none sm:h-72"
                role="img"
                aria-label={`${pair} ${timeframe} candlestick chart`}
              >
                {/* Horizontal grid lines */}
                {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                  const y = 18 + ratio * 195;
                  const priceLabel = maxHigh - ratio * priceSpan;
                  return (
                    <g key={ratio}>
                      <line
                        x1="0"
                        y1={y}
                        x2="655"
                        y2={y}
                        className="stroke-slate-200 dark:stroke-white/[0.07]"
                        strokeDasharray="3 3"
                      />
                      <text
                        x="662"
                        y={y + 4}
                        className="fill-slate-500 dark:fill-slate-400"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {priceLabel.toFixed(0)}
                      </text>
                    </g>
                  );
                })}

                {/* Smooth EMA Line */}
                <polyline
                  fill="none"
                  stroke="#B4831D"
                  strokeWidth="1.6"
                  strokeOpacity="0.9"
                  points={candles
                    .map((c, idx) => {
                      const x = 14 + idx * 18;
                      const avg = (c.high + c.low + c.close) / 3;
                      const y = 18 + ((maxHigh - avg) / priceSpan) * 195;
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />

                {/* Candlesticks + Volume Bars */}
                {candles.map((c, idx) => {
                  const x = 14 + idx * 18;
                  const isBull = c.close >= c.open;
                  const color = isBull ? '#059669' : '#DC2626';
                  const yHigh = 18 + ((maxHigh - c.high) / priceSpan) * 195;
                  const yLow = 18 + ((maxHigh - c.low) / priceSpan) * 195;
                  const yOpen = 18 + ((maxHigh - c.open) / priceSpan) * 195;
                  const yClose = 18 + ((maxHigh - c.close) / priceSpan) * 195;
                  const bodyTop = Math.min(yOpen, yClose);
                  const bodyHeight = Math.max(2.5, Math.abs(yClose - yOpen));
                  const volHeight = (c.volume / 100) * 38;

                  return (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className="cursor-crosshair"
                    >
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1.3" />
                      <rect
                        x={x - 5}
                        y={bodyTop}
                        width={10}
                        height={bodyHeight}
                        fill={color}
                        rx="1"
                      />
                      <rect
                        x={x - 4}
                        y={268 - volHeight}
                        width={8}
                        height={volHeight}
                        fill={color}
                        fillOpacity="0.28"
                      />
                      {hoverIdx === idx && (
                        <line
                          x1={x}
                          y1="10"
                          x2={x}
                          y2="270"
                          stroke="rgba(180,131,29,0.55)"
                          strokeDasharray="2 2"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Order Book Depth */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-white/[0.07] dark:bg-[#090E14]">
              <div>
                <p className="mb-2 font-semibold text-slate-500 dark:text-slate-400">
                  Bids (Buy Depth)
                </p>
                <div className="space-y-1 font-mono-num">
                  {orderBook.bids.map((b, i) => (
                    <div key={i} className="relative flex justify-between px-1.5 py-0.5">
                      <div
                        className="absolute inset-y-0 right-0 bg-emerald-500/12"
                        style={{ width: `${b.depth}%` }}
                      />
                      <span className="relative font-medium text-emerald-700 dark:text-[#10B981]">
                        {b.price.toFixed(2)}
                      </span>
                      <span className="relative text-slate-700 dark:text-slate-300">{b.size}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 font-semibold text-slate-500 dark:text-slate-400">
                  Asks (Sell Depth)
                </p>
                <div className="space-y-1 font-mono-num">
                  {orderBook.asks.map((a, i) => (
                    <div key={i} className="relative flex justify-between px-1.5 py-0.5">
                      <div
                        className="absolute inset-y-0 right-0 bg-red-500/12"
                        style={{ width: `${a.depth}%` }}
                      />
                      <span className="relative font-medium text-red-600 dark:text-red-400">
                        {a.price.toFixed(2)}
                      </span>
                      <span className="relative text-slate-700 dark:text-slate-300">{a.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Signal Execution Column */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/[0.11] dark:bg-[#0B1018] sm:p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#8F6510] dark:text-[#D4AF37]" />
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Signal Execution Desk
                  </h3>
                </div>
                <span className="font-mono-num text-xs font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                  {fixedStatus.status === 'OPEN'
                    ? `Expires in ${formatScheduleRemaining(fixedStatus.remainingMs)}`
                    : `Next: ${fixedStatus.nextSlotLabel}`}
                </span>
              </div>

              {/* Active Schedule Summary */}
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 dark:border-white/[0.09] dark:bg-[#111923] dark:text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Daily Regular Windows</span>
                  <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                    {schedule.regularTimes}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    New-User / Sponsor Extra
                  </span>
                  <span className="font-mono-num font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                    {schedule.extraTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Compounding Base (Cap + Profit)
                  </span>
                  <span className="font-mono-num font-bold text-emerald-700 dark:text-[#10B981]">
                    ${formatUsdt(compoundingBase)} USDT
                  </span>
                </div>
              </div>

              {/* Live Admin-Configured Telegram Signal Group / Channel */}
              {(telegramGroupUrl || telegramChannelUrl) && (
                <div className="flex flex-wrap gap-2">
                  {telegramGroupUrl && (
                    <a
                      href={telegramGroupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 min-w-[165px] min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3 py-1.5 text-xs font-semibold text-[#8F6510] hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0" />
                      <span>Signal Telegram Group</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                  {telegramChannelUrl && (
                    <a
                      href={telegramChannelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 min-w-[165px] min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-[#111923] dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <Send className="h-3.5 w-3.5 shrink-0 text-[#8F6510] dark:text-[#D4AF37]" />
                      <span>Official Channel</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
              )}

              {/* Fixed Daily Schedule Expiry / Upcoming Indicator */}
              {fixedStatus.status === 'OPEN' ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs dark:border-[#10B981]/25 dark:bg-[#10B981]/5">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {fixedStatus.slotLabel}
                    </span>
                    <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      Ends {fixedStatus.endsAtLabel} ({fixedStatus.timezone})
                    </span>
                  </div>
                  <span className="font-mono-num font-semibold text-emerald-700 dark:text-[#10B981]">
                    {formatScheduleRemaining(fixedStatus.remainingMs)} left
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-white/[0.08] dark:bg-[#111923]">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {fixedStatus.nextSlotLabel}
                    </span>
                    <span className="mx-1.5 text-slate-400 dark:text-slate-500">·</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Fixed Schedule ({fixedStatus.timezone})
                    </span>
                  </div>
                  <span className="font-mono-num font-semibold text-[#8F6510] dark:text-[#D4AF37]">
                    Starts in {formatScheduleRemaining(fixedStatus.startsInMs)}
                  </span>
                </div>
              )}

              {/* Signal Paste Form OR Locked State */}
              {loading ? (
                <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-white/5" />
              ) : !isDepositActive ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-500/25 dark:bg-amber-950/20 space-y-2">
                  <Lock className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-400" />
                  <p className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Signal Execution Locked
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Signal code entry remains locked until you complete an approved deposit of at
                    least $100 USDT. Open the Wallet tab to fund your Trading Capital.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleExecuteSignal} className="space-y-3">
                  <div>
                    <label
                      htmlFor="signal-code-input"
                      className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Paste Group Signal Code
                    </label>
                    <input
                      id="signal-code-input"
                      type="text"
                      required
                      value={signalCode}
                      onChange={(e) => setSignalCode(e.target.value.toUpperCase())}
                      placeholder="e.g. VQ-SIG-8K4M2X"
                      className="font-mono-num h-12 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-[#B4831D] focus:outline-none dark:border-white/15 dark:bg-[#111923] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Capital: ${formatUsdt(capitalBalance)}</span>
                    <span>Profit: ${formatUsdt(profitBalance)}</span>
                    <span className="font-semibold text-emerald-700 dark:text-[#10B981]">
                      Est. +${formatUsdt(compoundingBase * (schedule.profitPercent / 100))} @{' '}
                      {schedule.profitPercent.toFixed(2)}%
                    </span>
                  </div>

                  {feedback && (
                    <div
                      className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                        feedback.type === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-[#10B981]'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200'
                      }`}
                    >
                      {feedback.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0F172A] text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>{submitting ? 'Executing Signal...' : 'Execute Signal'}</span>
                  </button>
                </form>
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
              Fixed daily schedule slots accept entries for {schedule.validityMinutes} minutes and
              credit compounded profits automatically once trade processing completes.
            </div>
          </div>
        </div>
      </div>

      {/* Signal Execution & 20-Minute Settlement Ledger */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/[0.08] dark:bg-[#111923]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Your Signal Executions &amp; Settlements
          </h3>
          <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
            {claims.length} Records
          </span>
        </div>

        {claims.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No signal executions recorded yet. Paste an active group signal code above when
            funded.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                  <th className="py-2.5 pr-4 font-semibold">Signal</th>
                  <th className="py-2.5 pr-4 font-semibold">Type</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Total Base</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Yield</th>
                  <th className="py-2.5 pr-4 font-semibold text-right">Profit</th>
                  <th className="py-2.5 font-semibold text-right">Settlement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-num dark:divide-white/[0.05]">
                {claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {c.signal_code}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {c.pair}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                      {c.signal_type}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-800 dark:text-slate-200">
                      ${formatUsdt(c.total_base)}
                    </td>
                    <td className="py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                      {c.profit_percent}%
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-emerald-700 dark:text-[#10B981]">
                      +${formatUsdt(c.expected_profit)}
                    </td>
                    <td className="py-3 text-right">
                      {c.status === 'SETTLED' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-[#10B981]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                          <Clock className="h-3.5 w-3.5" />
                          Processing
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
