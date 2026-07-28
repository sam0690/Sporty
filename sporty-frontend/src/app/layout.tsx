import type { Metadata, Viewport } from "next";
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Sporty — one league, every game",
    template: "%s · Sporty",
  },
  description:
    "Multi-sport fantasy leagues across football, basketball and cricket. Build one squad, score from real matches, live.",
  applicationName: "Sporty",
  openGraph: {
    title: "Sporty — one league, every game",
    description:
      "Multi-sport fantasy leagues across football, basketball and cricket. Build one squad, score from real matches, live.",
    siteName: "Sporty",
    type: "website",
  },
};

// Ink & Gold — the mask/address bar is the brand's page floor.
export const viewport: Viewport = {
  themeColor: "#0a0a0f",
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
