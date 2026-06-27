import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Risk Watch · 宏观风险预警",
  description:
    "Configurable macro-risk dashboard demo — bring your own data & database, with pluggable AI risk reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
