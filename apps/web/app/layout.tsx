import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crow',
  description: '1日の作業をカレンダーベースで記録するアプリ',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" data-theme="light">
      <body>{children}</body>
    </html>
  );
}