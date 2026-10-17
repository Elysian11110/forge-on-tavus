import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// The Forge site's three faces: Inter Tight for reading and the big headlines, Fraunces for quoted
// words, JetBrains Mono for short tags.
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter-tight",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Forge",
  description: "A friend who knows way too much about personality types, on a short video call.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
