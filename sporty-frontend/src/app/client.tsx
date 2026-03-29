"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/context/Query-context";
import { AuthProvider } from "@/context/auth-context";

/**
 * Root client-side provider wrapper.
 *
 * Register every global provider here so that layout.tsx stays clean
 * and server-renderable.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
    return (
        <QueryProvider>
            <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
    );
}
