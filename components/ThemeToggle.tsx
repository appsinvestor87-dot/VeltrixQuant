'use client';

import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, []);

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    try {
      localStorage.setItem('vq_theme', next);
    } catch {
      // ignore storage restrictions
    }
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-[#111923] dark:text-slate-200 dark:hover:border-[#D4AF37]/40 dark:hover:bg-white/[0.04] whitespace-nowrap shrink-0"
    >
      {theme === 'dark' ? (
        <>
          <Sun className="h-3.5 w-3.5 text-[#D4AF37]" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-3.5 w-3.5 text-[#8F6510]" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
}
