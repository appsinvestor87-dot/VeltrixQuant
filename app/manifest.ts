import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Veltrix Quant',
    short_name: 'VeltrixQuant',
    description:
      'Institutional USDT BEP20 Quantitative Signal Execution, Treasury & Team Performance Platform.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B1117',
    theme_color: '#0B1117',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
