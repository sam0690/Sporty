"use client";

import { QueryClient, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";

/**
 * TanStack Query provider — wraps the app with a QueryClient.
 *
 * Default options:
 * - staleTime: 5 minutes
 * - retry: 1
 * - refetchOnWindowFocus: false
 * - gcTime: 24h (must be >= the persister's maxAge, or restored queries are
 *   garbage-collected the moment they are rehydrated)
 *
 * Reference data is persisted to localStorage so a reload does not refetch it.
 * The API sends `Cache-Control: no-store` on every authenticated response and
 * always will, so this is the only layer that can survive a refresh.
 */

const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Allowlist — query key roots safe to write to localStorage.
 *
 * Deliberately an allowlist rather than a denylist: a new user-scoped query
 * added later defaults to "not persisted" instead of silently leaking into
 * storage. Two rules decide membership:
 *
 *  1. The response must be the same for every user. Anything derived from the
 *     session (["auth","me"], ["leagues",...], ["users",...]) stays out — it
 *     outlives logout in localStorage, so the next account on this browser
 *     would be served the previous one's data.
 *  2. The data must not be live. ["matches"] is excluded even though it is
 *     user-independent: rehydrating it paints stale scores before the socket
 *     connects. ["leagues",*,"draft-turn"] is doubly excluded — it is written
 *     by SSE and polled every 3s as a missed-frame fallback, so a restored
 *     copy would replay a stale draft clock.
 */
const PERSISTED_KEY_ROOTS = new Set([
  "players",
  "competitions",
  "fixtures",
  "seasons",
  "sports",
  "scoring",
]);

export const shouldPersist = (query: Query): boolean => {
  // status check mirrors TanStack's default — never persist a pending or
  // errored query, or a reload restores a failure as if it were data.
  if (query.state.status !== "success") return false;
  const root = query.queryKey[0];
  return typeof root === "string" && PERSISTED_KEY_ROOTS.has(root);
};

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,
                        gcTime: PERSIST_MAX_AGE,
                        retry: 1,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
    );

    const [persistOptions] = useState(() => ({
        persister: createSyncStoragePersister({
            // Guarded for SSR: this component renders on the server too, where
            // there is no localStorage.
            storage: typeof window === "undefined" ? undefined : window.localStorage,
            key: "sporty.query-cache",
        }),
        maxAge: PERSIST_MAX_AGE,
        // Bump on deploy so a shipped shape change can never be rehydrated
        // from an old client's storage. Vercel injects the commit SHA; the
        // fallback only applies to local dev.
        buster: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev",
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
    }));

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={persistOptions}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
