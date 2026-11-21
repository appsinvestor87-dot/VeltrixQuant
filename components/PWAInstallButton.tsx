'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsInstalled(standalone);

      const ua = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(ua));
    }, 0);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#C6972C]/45 bg-[#C6972C]/10 px-3 py-1.5 text-xs font-semibold text-[#8F6510] transition-colors hover:bg-[#C6972C]/20 dark:border-[#D4AF37]/40 dark:bg-[#D4AF37]/10 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/20 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{deferredPrompt ? 'Install App' : isIOS ? 'Install on iOS' : 'Get App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Install Veltrix Quant App"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#111923]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-5 w-5 text-[#8F6510] dark:text-[#D4AF37]" />
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Install Veltrix Quant
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {isIOS ? (
                <>
                  <p>1. Tap the Share icon in your Safari toolbar.</p>
                  <p>2. Scroll down and select Add to Home Screen.</p>
                </>
              ) : (
                <>
                  <p>
                    1. Open your browser menu (three dots in Chrome or Edge) and choose{' '}
                    <strong className="text-slate-900 dark:text-white">Install App</strong> or{' '}
                    <strong className="text-slate-900 dark:text-white">Add to Home screen</strong>.
                  </p>
                  <p>
                    2. Once installed, Veltrix Quant launches in full-screen standalone app mode and
                    receives server updates automatically.
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#0F172A] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    }, 0);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.clearTimeout(syncTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 shadow-lg dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-200 md:bottom-6">
      <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span>Connection lost. Reconnect to sync balances and execute signals.</span>
    </div>
  );
}
