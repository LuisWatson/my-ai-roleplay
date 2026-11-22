import './globals.css';
import { Maitree, IBM_Plex_Sans_Thai } from 'next/font/google';

// Self-hosted by Next at build time. Maitree (soft Thai serif) for names and headings; IBM Plex Sans Thai
// for everything else: the system font drew Thai badly on Windows
const display = Maitree({
  subsets: ['thai', 'latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-display',
});
const body = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex',
});

export const metadata = {
  title: 'Verse',
  description: 'Personal AI Roleplay App',
  // Added to the iPhone home screen, it opens full screen with the app's own title
  appleWebApp: { capable: true, title: 'Verse', statusBarStyle: 'black' },
};

export const viewport = {
  themeColor: '#050505',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`}>
      <body className="bg-slate-900 text-slate-100 antialiased h-dvh overflow-hidden">
        {children}
      </body>
    </html>
  );
}