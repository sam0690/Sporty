"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { useAdminLeagues } from "@/hooks/admin/useAdminLeagues";
import {
  useRecalculateWindowScore,
  useRecalculateActiveWindows,
  useSetWindowLock,
} from "@/hooks/admin/useAdminScoring";

export function AdminScoring() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const { data: leagues } = useAdminLeagues({ page: 1, pageSize: 100 });
  const [leagueId, setLeagueId] = useState("");
  const [windowId, setWindowId] = useState("");

  const recalculateWindow = useRecalculateWindowScore();
  const recalculateActive = useRecalculateActiveWindows();
  const setLock = useSetWindowLock();

  return (
    <div className="space-y-6">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Scoring</h1>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-4">
        <p className="section-label">Recalculate a transfer window</p>

        <div className="flex flex-wrap gap-3">
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#0d0d14] px-3 py-2 text-sm text-[#f0f0f0]"
          >
            <option value="">Select a league…</option>
            {leagues?.items.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={windowId}
            onChange={(e) => setWindowId(e.target.value)}
            placeholder="Transfer window ID"
            className="w-72 rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#0d0d14] px-3 py-2 text-sm text-[#f0f0f0] placeholder:text-[#555560]"
          />

          <Button
            variant="primary"
            size="sm"
            disabled={!leagueId || !windowId || recalculateWindow.isPending}
            onClick={() => recalculateWindow.mutate({ leagueId, windowId })}
          >
            Recalculate Score
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!windowId || setLock.isPending}
            onClick={() => setLock.mutate({ windowId, transfers_locked: true })}
          >
            Lock Transfers
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!windowId || setLock.isPending}
            onClick={() => setLock.mutate({ windowId, transfers_locked: false })}
          >
            Unlock Transfers
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!windowId || setLock.isPending}
            onClick={() => setLock.mutate({ windowId, lineup_locked: true })}
          >
            Lock Lineups
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!windowId || setLock.isPending}
            onClick={() => setLock.mutate({ windowId, lineup_locked: false })}
          >
            Unlock Lineups
          </Button>
        </div>
        <p className="text-xs text-[#555560]">
          Find a window ID via the league&apos;s dashboard or the audit log.
        </p>
      </section>

      {isSuperAdmin && (
        <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
          <p className="section-label">Platform-wide</p>
          <Button
            variant="danger"
            size="sm"
            disabled={recalculateActive.isPending}
            onClick={() => {
              if (window.confirm("Recalculate scoring for every active transfer window platform-wide?")) {
                recalculateActive.mutate();
              }
            }}
          >
            Recalculate All Active Windows
          </Button>
        </section>
      )}
    </div>
  );
}
