"use client";

import type { ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { QueryProvider } from "@/context/Query-context";
import { AuthProvider } from "@/context/auth-context";
import { BrandSplash } from "@/components/brand/BrandSplash";

/**
 * Root client-side provider wrapper.
 *
 * Register every global provider here so that layout.tsx stays clean
 * and server-renderable.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider defaultColorScheme="dark">
      <QueryProvider>
        <AuthProvider>
          <BrandSplash />
          {children}
        </AuthProvider>
      </QueryProvider>
    </MantineProvider>
  );
}
