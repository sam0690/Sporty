import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import "./globals.css";
import { ClientProviders } from "./client";

// Design_System.md §3 — Barlow Condensed (600/700) for display/headlines/
// stats/kickers, Barlow (300–700) for body copy.
const barlowCondensed = Barlow_Condensed({
  variable: "--ff-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const barlow = Barlow({
  variable: "--ff-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
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
      className={`${barlowCondensed.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
