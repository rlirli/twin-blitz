import { Suspense } from "react";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { NuqsAdapter } from "nuqs/adapters/next/app";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Twin Blitz — Custom Matching Card Game Generator",
  description:
    "Design and print your own personalized matching card game. Upload 57 custom symbols and Twin Blitz generates a perfectly balanced 57-card deck where every pair of cards shares exactly one symbol. The perfect custom gift.",
  keywords: [
    "custom card game",
    "personalized matching game",
    "custom symbol card deck",
    "DIY card game gift",
    "personalized spot the match game",
    "57 symbol card deck generator",
    "print your own card game",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Suspense>
          <NuqsAdapter>{children}</NuqsAdapter>
        </Suspense>
      </body>
    </html>
  );
}
