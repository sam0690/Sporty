"use client";

import type { ReactNode } from "react";
import { createTheme, MantineProvider } from "@mantine/core";
import { QueryProvider } from "@/context/Query-context";
import { AuthProvider } from "@/context/auth-context";

/**
 * Mantine theme wired to the "Broadcast" design system (Design_System.md).
 * Red primary, Barlow font stack, sharp radius.
 */
const theme = createTheme({
  primaryColor: "brand",
  primaryShade: 6,
  colors: {
    brand: [
      "#FEF2F2",
      "#FEE2E2",
      "#FECACA",
      "#FCA5A5",
      "#F87171",
      "#EF4444",
      "#DC2626",
      "#B91C1C",
      "#991B1B",
      "#7F1D1D",
    ],
  },
  fontFamily: "var(--font-sans)",
  headings: { fontFamily: "var(--font-condensed)" },
  defaultRadius: "sm",
});

/**
 * Root client-side provider wrapper.
 *
 * Register every global provider here so that layout.tsx stays clean
 * and server-renderable.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <QueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </QueryProvider>
    </MantineProvider>
  );
}
