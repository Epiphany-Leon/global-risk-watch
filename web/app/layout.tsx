import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Risk Watch · 宏观风险预警",
  description:
    "Configurable macro-risk dashboard demo — bring your own data & database, with pluggable AI risk reports.",
};

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
const themeInit = `(function(){try{var t=localStorage.getItem('grw-theme');var d=document.documentElement;if(t==='light'){d.classList.remove('dark')}else{d.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
