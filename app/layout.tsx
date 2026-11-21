import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plus-jakarta',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
});

export const viewport: Viewport = {
  themeColor: '#0B1117',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Veltrix Quant — Quantitative USDT Signal & Treasury Platform',
  description:
    'Veltrix Quant — Institutional USDT BEP20 Quantitative Signal Execution, Treasury & Team Performance Platform.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VeltrixQuant',
  },
  icons: {
    icon: '/pwa-192x192.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Veltrix Quant — Quantitative USDT Signal & Treasury Platform',
    description:
      'Veltrix Quant — Institutional USDT BEP20 Quantitative Signal Execution, Treasury & Team Performance Platform.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Veltrix Quant',
    description:
      'Institutional USDT BEP20 Quantitative Signal Execution, Treasury & Team Performance Platform.',
  },
};

const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('vq_theme');
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="min-h-screen bg-[#F4F6FA] text-slate-900 dark:bg-[#090E14] dark:text-slate-100 antialiased transition-colors duration-200"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
