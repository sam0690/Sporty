import { describe, expect, it } from "vitest";
import type { Query } from "@tanstack/react-query";

import { shouldPersist } from "./Query-context";

/**
 * The query cache is written to localStorage, which outlives logout. The
 * allowlist is what stops one account's data being rehydrated for the next
 * person to sign in on the same browser — so the "must not persist" cases
 * below are the ones that matter.
 */
const query = (queryKey: unknown[], status = "success") =>
  ({ queryKey, state: { status } }) as unknown as Query;

describe("shouldPersist", () => {
  it("persists user-independent reference data", () => {
    expect(shouldPersist(query(["players", "list", "{}"]))).toBe(true);
    expect(shouldPersist(query(["competitions", "index"]))).toBe(true);
    expect(shouldPersist(query(["fixtures", "list", "{}"]))).toBe(true);
    expect(shouldPersist(query(["seasons"]))).toBe(true);
    expect(shouldPersist(query(["sports"]))).toBe(true);
    expect(shouldPersist(query(["scoring", "rules", "football"]))).toBe(true);
  });

  it("never persists user-scoped data", () => {
    expect(shouldPersist(query(["auth", "me"]))).toBe(false);
    expect(shouldPersist(query(["leagues", "me"]))).toBe(false);
    expect(shouldPersist(query(["leagues", "abc", "my-team"]))).toBe(false);
    expect(shouldPersist(query(["users", "me", "activity", "abc"]))).toBe(false);
    expect(shouldPersist(query(["transfers", "me"]))).toBe(false);
    expect(shouldPersist(query(["notifications"]))).toBe(false);
  });

  it("never persists live or realtime-driven data", () => {
    // Rehydrating these paints stale scores before the socket connects.
    expect(shouldPersist(query(["matches", "list", "{}"]))).toBe(false);
    expect(shouldPersist(query(["matches", "live-for-favourites"]))).toBe(false);
    // Written by SSE and polled every 3s — a restored copy replays a stale clock.
    expect(shouldPersist(query(["leagues", "abc", "draft-turn"]))).toBe(false);
  });

  it("does not persist pending or errored queries", () => {
    expect(shouldPersist(query(["players", "list"], "pending"))).toBe(false);
    expect(shouldPersist(query(["players", "list"], "error"))).toBe(false);
  });

  it("tolerates a non-string key root", () => {
    expect(shouldPersist(query([42]))).toBe(false);
    expect(shouldPersist(query([]))).toBe(false);
  });
});
