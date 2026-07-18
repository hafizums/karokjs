import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Karoks — Browser Karaoke",
  description:
    "Phase 1 demo: synchronized browser karaoke with local audio and timed lyrics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const bodyStyle = {
    ["--font-body"]: "var(--font-figtree), sans-serif",
    ["--font-display"]: "var(--font-fraunces), serif",
  } as CSSProperties;

  return (
    <html lang="en" className={`${figtree.variable} ${fraunces.variable}`}>
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
