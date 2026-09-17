import type { Metadata } from 'next';
import './globals.css';
import './extra.css';
import './login.css';
import './report.css';

export const metadata: Metadata = {
  title: 'Mahmood | سیستەمی میوەفرۆشی',
  description: 'سیستەمی کڕین و فرۆشتنی میوە بە زمانی کوردی',
  openGraph: { title: 'Mahmood', description: 'سیستەمی کڕین و فرۆشتن', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'Mahmood', description: 'سیستەمی کڕین و فرۆشتن', images: ['/og.png'] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ckb" dir="rtl"><body>{children}</body></html>;
}
