import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import "./globals.css";
import { ClientProviders } from "./client";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
