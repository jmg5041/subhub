/**
 * Root layout — the HTML shell for the entire app.
 * 
 * This is Next.js's top-level layout. It sets up:
 * - Font (Inter from Google Fonts — clean, modern, great for dashboards)
 * - Global CSS (Tailwind)
 * - Theme metadata
 * 
 * All pages are wrapped in this layout. Auth pages and app pages 
 * have their own sub-layouts (auth layout, app layout with sidebar).
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SubHub — Substitute Teacher Management',
  description: 'Modern substitute teacher management for K-12 schools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}