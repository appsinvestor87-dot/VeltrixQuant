import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#090E14] dark:text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#111923] p-8 text-center space-y-4 shadow-sm">
        <p className="font-mono-num text-xs font-semibold uppercase tracking-widest text-[#8F6510] dark:text-[#D4AF37]">
          HTTP 404
        </p>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          The requested endpoint does not exist or is not accessible from your current session.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#0F172A] text-white hover:bg-slate-800 dark:bg-[#D4AF37] dark:text-[#090E14] dark:hover:bg-[#E5C354] px-5 text-xs font-semibold transition-colors"
          >
            Return to Veltrix Quant
          </Link>
        </div>
      </div>
    </main>
  );
}
