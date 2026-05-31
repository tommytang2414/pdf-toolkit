import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF Toolkit — by tommytang",
  description: "Merge, split, rotate, and reorder PDFs. No upload. No tracking. Just works.",
  icons: {
    icon: "/favicon.svg",
  },
};

const GeistSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const GeistMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`} style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}