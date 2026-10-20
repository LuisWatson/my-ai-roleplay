import './globals.css';

export const metadata = {
  title: 'My AI Roleplay',
  description: 'Personal AI Roleplay App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className="bg-slate-900 text-slate-100 antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}