import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STQ Education Portal — STQ Darul Ulum Cendekia',
    short_name: 'STQ DUC',
    description: 'Sistem Informasi Manajemen STQ Darul Ulum Cendekia - Sekolah Tahfizh Al-Qur\'an Full Beasiswa untuk Yatim dan Dhuafa, Yayasan Infak Medika Nusantara',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F7F9F7',
    theme_color: '#0E7C3A',
    lang: 'id',
    icons: [
      {
        src: '/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/pwa/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
