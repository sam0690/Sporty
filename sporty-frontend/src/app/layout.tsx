import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import "./globals.css";
import { ClientProviders } from "./client";

// Design_System.md §3 — Inter (700–900) for display/headlines/stats,
// DM Sans (400–700) for body and micro-labels.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "700", "800", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Sporty",
  description: "Your ultimate sports companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
