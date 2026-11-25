import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AntiInspectProtection from '@/components/AntiInspectProtection';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CEK BANSOS 2026 — Situs Resmi',
  description: 'Pengecekan Data List Bansos Tahun 2026.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <AntiInspectProtection />
        {children}
      </body>
    </html>
  );
}
