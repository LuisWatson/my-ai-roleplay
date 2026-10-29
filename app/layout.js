import './globals.css';
import { Prompt } from 'next/font/google';

// Prompt for names and headings only (self-hosted by Next at build time); body text stays on the system
// font, which is easiest to read at chat length
const display = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata = {
  title: 'Verse',
  description: 'Personal AI Roleplay App',
  // Added to the iPhone home screen, it opens full screen with the app's own title
  appleWebApp: { capable: true, title: 'Verse', statusBarStyle: 'black' },
};

export const viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={display.variable}>
      <body className="bg-slate-900 text-slate-100 antialiased h-dvh overflow-hidden">
        {children}
      </body>
    </html>
  );
}