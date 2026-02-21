import type {Metadata} from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Brutalist Notes',
  description: 'A simple, minimalist note-taking app.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body suppressHydrationWarning className="bg-[#F5F2ED] text-black antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
