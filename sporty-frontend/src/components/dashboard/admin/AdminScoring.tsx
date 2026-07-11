"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { ConfirmDialog } from "@/components/dashboard/admin/ConfirmDialog";
import { useAdminLeagues } from "@/hooks/admin/useAdminLeagues";
import {
  useRecalculateWindowScore,
  useRecalculateActiveWindows,
  useSetWindowLock,
  useLeagueTransferWindows,
} from "@/hooks/admin/useAdminScoring";

function formatWindowLabel(w: { number: number; start_at: string; end_at: string }): string {
  const start = new Date(w.start_at).toLocaleDateString();
  const end = new Date(w.end_at).toLocaleDateString();
  return `Window ${w.number} (${start} – ${end})`;
}

export function AdminScoring() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const { data: leagues, isError: leaguesError, refetch: refetchLeagues } = useAdminLeagues({ page: 1, pageSize: 100 });
  const [leagueId, setLeagueId] = useState("");
  const [windowId, setWindowId] = useState("");
  const [showRecalcAllConfirm, setShowRecalcAllConfirm] = useState(false);

  const { data: windows, isLoading: windowsLoading } = useLeagueTransferWindows(leagueId);

  const recalculateWindow = useRecalculateWindowScore();
  const recalculateActive = useRecalculateActiveWindows();
  const setLock = useSetWindowLock();

  if (leaguesError) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Scoring</h1>
        <AdminErrorState message="Couldn't load leagues." onRetry={() => refetchLeagues()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Scoring</h1>

      <section className="card-surface p-5 space-y-4">
        <p className="section-label">Recalculate a transfer window</p>

        <div className="flex flex-wrap gap-3">
          <select
            value={leagueId}
            onChange={(e) => {
              setLeagueId(e.target.value);
              setWindowId("");
            }}
            className="rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1"
          >
            <option value="">Select a league…</option>
            {leagues?.items.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select
            value={windowId}
            onChange={(e) => setWindowId(e.target.value)}
            disabled={!leagueId || windowsLoading}
            className="w-72 rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 disabled:opacity-50"
          >
            <option value="">{windowsLoading ? "Loading windows…" : "Select a window…"}</option>
            {windows?.map((w) => (
              <option key={w.id} value={w.id}>
                {formatWindowLabel(w)}
                {w.transfers_locked ? " · transfers locked" : ""}
              </option>
            ))}
          </select>

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
      </section>

      {isSuperAdmin && (
        <section className="card-surface p-5 space-y-3">
          <p className="section-label">Platform-wide</p>
          <Button
            variant="danger"
            size="sm"
            disabled={recalculateActive.isPending}
            onClick={() => setShowRecalcAllConfirm(true)}
          >
            Recalculate All Active Windows
          </Button>
        </section>
      )}

      <ConfirmDialog
        isOpen={showRecalcAllConfirm}
        title="Recalculate All Active Windows"
        message="Recalculate scoring for every active transfer window platform-wide?"
        confirmLabel="Recalculate"
        variant="danger"
        isPending={recalculateActive.isPending}
        onClose={() => setShowRecalcAllConfirm(false)}
        onConfirm={() => recalculateActive.mutate(undefined, { onSuccess: () => setShowRecalcAllConfirm(false) })}
      />
    </div>
  );
}
