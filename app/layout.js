import './globals.css';

export const metadata = {
  title: 'Botbaat',
  description: 'Personal AI Roleplay App',
  // Added to the iPhone home screen, it opens full screen with the app's own title
  appleWebApp: { capable: true, title: 'Botbaat', statusBarStyle: 'black' },
};

export const viewport = {
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-900 text-slate-100 antialiased h-dvh overflow-hidden">
        {children}
      </body>
    </html>
  );
}