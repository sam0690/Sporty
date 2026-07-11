"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { ConfirmDialog } from "@/components/dashboard/admin/ConfirmDialog";
import { useAdminLeagues } from "@/hooks/admin/useAdminLeagues";
import {
  useVetoTrade,
  useCancelTrade,
  useCancelWaiverClaim,
  useReverseTransfer,
  useLeagueTrades,
  useLeagueWaiverClaims,
  useLeagueTransfers,
} from "@/hooks/admin/useAdminTransactions";

function LeagueSelect({
  leagues,
  value,
  onChange,
}: {
  leagues: { id: string; name: string }[] | undefined;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-64 rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1"
    >
      <option value="">Select a league…</option>
      {leagues?.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

export function AdminTransactions() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const { data: leagues, isError: leaguesError, refetch: refetchLeagues } = useAdminLeagues({ page: 1, pageSize: 100 });

  const [tradeLeagueId, setTradeLeagueId] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [waiverLeagueId, setWaiverLeagueId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [transferLeagueId, setTransferLeagueId] = useState("");
  const [transferId, setTransferId] = useState("");
  const [showCancelTradeConfirm, setShowCancelTradeConfirm] = useState(false);
  const [showReverseTransferConfirm, setShowReverseTransferConfirm] = useState(false);

  const { data: trades, isLoading: tradesLoading } = useLeagueTrades(tradeLeagueId);
  const { data: claims, isLoading: claimsLoading } = useLeagueWaiverClaims(waiverLeagueId);
  const { data: transfers, isLoading: transfersLoading } = useLeagueTransfers(transferLeagueId, true);

  const vetoTrade = useVetoTrade();
  const cancelTrade = useCancelTrade();
  const cancelWaiverClaim = useCancelWaiverClaim();
  const reverseTransfer = useReverseTransfer();

  if (leaguesError) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Transactions</h1>
        <AdminErrorState message="Couldn't load leagues." onRetry={() => refetchLeagues()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Transactions</h1>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Trades</p>
        <div className="flex flex-wrap items-center gap-3">
          <LeagueSelect
            leagues={leagues?.items}
            value={tradeLeagueId}
            onChange={(v) => {
              setTradeLeagueId(v);
              setTradeId("");
            }}
          />
          <select
            value={tradeId}
            onChange={(e) => setTradeId(e.target.value)}
            disabled={!tradeLeagueId || tradesLoading}
            className="w-96 rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 disabled:opacity-50"
          >
            <option value="">{tradesLoading ? "Loading trades…" : "Select a trade…"}</option>
            {trades?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.from_team_name} → {t.to_team_name} · {t.offered_count}-for-{t.requested_count} · {t.status}
              </option>
            ))}
          </select>
          {trades?.length === 0 && !tradesLoading && (
            <span className="text-xs text-fg-3">No actionable trades in this league.</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!tradeLeagueId || !tradeId || vetoTrade.isPending}
            onClick={() => vetoTrade.mutate({ leagueId: tradeLeagueId, tradeId })}
          >
            Veto Trade
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!tradeLeagueId || !tradeId || cancelTrade.isPending}
            onClick={() => setShowCancelTradeConfirm(true)}
          >
            Force Cancel Trade
          </Button>
        </div>
      </section>

      <section className="card-surface p-5 space-y-3">
        <p className="section-label">Waivers</p>
        <div className="flex flex-wrap items-center gap-3">
          <LeagueSelect
            leagues={leagues?.items}
            value={waiverLeagueId}
            onChange={(v) => {
              setWaiverLeagueId(v);
              setClaimId("");
            }}
          />
          <select
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            disabled={!waiverLeagueId || claimsLoading}
            className="w-96 rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 disabled:opacity-50"
          >
            <option value="">{claimsLoading ? "Loading claims…" : "Select a pending claim…"}</option>
            {claims?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.team_name}: claim {c.add_player_name}, drop {c.drop_player_name}
              </option>
            ))}
          </select>
          {claims?.length === 0 && !claimsLoading && (
            <span className="text-xs text-fg-3">No pending claims in this league.</span>
          )}
        </div>
        <Button
          variant="danger"
          size="sm"
          disabled={!waiverLeagueId || !claimId || cancelWaiverClaim.isPending}
          onClick={() => cancelWaiverClaim.mutate({ leagueId: waiverLeagueId, claimId })}
        >
          Force Cancel Claim
        </Button>
      </section>

      {isSuperAdmin && (
        <section className="card-surface p-5 space-y-3">
          <p className="section-label">Transfers</p>
          <div className="flex flex-wrap items-center gap-3">
            <LeagueSelect
              leagues={leagues?.items}
              value={transferLeagueId}
              onChange={(v) => {
                setTransferLeagueId(v);
                setTransferId("");
              }}
            />
            <select
              value={transferId}
              onChange={(e) => setTransferId(e.target.value)}
              disabled={!transferLeagueId || transfersLoading}
              className="w-96 rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 disabled:opacity-50"
            >
              <option value="">{transfersLoading ? "Loading transfers…" : "Select a reversible transfer…"}</option>
              {transfers?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.team_name}: {t.player_out_name} → {t.player_in_name} (£{t.cost_at_transfer.toFixed(1)}m)
                </option>
              ))}
            </select>
            {transfers?.length === 0 && !transfersLoading && (
              <span className="text-xs text-fg-3">No reversible transfers in this league.</span>
            )}
          </div>
          <Button
            variant="danger"
            size="sm"
            disabled={!transferId || reverseTransfer.isPending}
            onClick={() => setShowReverseTransferConfirm(true)}
          >
            Reverse Transfer
          </Button>
        </section>
      )}

      <ConfirmDialog
        isOpen={showCancelTradeConfirm}
        title="Force Cancel Trade"
        message="Force-cancel this trade regardless of who proposed it?"
        confirmLabel="Cancel Trade"
        variant="danger"
        isPending={cancelTrade.isPending}
        onClose={() => setShowCancelTradeConfirm(false)}
        onConfirm={() =>
          cancelTrade.mutate(
            { leagueId: tradeLeagueId, tradeId },
            { onSuccess: () => setShowCancelTradeConfirm(false) },
          )
        }
      />

      <ConfirmDialog
        isOpen={showReverseTransferConfirm}
        title="Reverse Transfer"
        message="Reverse this transfer? This restores the prior roster and budget state and cannot be undone."
        confirmLabel="Reverse"
        variant="danger"
        isPending={reverseTransfer.isPending}
        onClose={() => setShowReverseTransferConfirm(false)}
        onConfirm={() =>
          reverseTransfer.mutate({ transferId }, { onSuccess: () => setShowReverseTransferConfirm(false) })
        }
      />
    </div>
  );
}
