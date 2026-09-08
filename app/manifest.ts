import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STQ Education Portal - STQ Darul Ulum Cendekia',
    short_name: 'STQ DUC',
    description: 'Sistem Informasi Manajemen STQ Darul Ulum Cendekia - Sekolah Tahfizh Al-Qur\'an Full Beasiswa untuk Yatim dan Dhuafa, Yayasan Infak Medika Nusantara',
    start_url: '/',
    display: 'standalone',
    background_color: '#f0f9ff',
    theme_color: '#0E7C3A',
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
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
