"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasMinRole } from "@/lib/roles";
import { Button } from "@/components/ui/Button";
import {
  useVetoTrade,
  useCancelTrade,
  useCancelWaiverClaim,
  useReverseTransfer,
} from "@/hooks/admin/useAdminTransactions";

function IdForm({
  fields,
  onSubmit,
  submitLabel,
  disabled,
  variant = "primary",
}: {
  fields: { label: string; value: string; onChange: (v: string) => void }[];
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
  variant?: "primary" | "danger";
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-1">
          <label className="text-xs text-[#555560]">{f.label}</label>
          <input
            type="text"
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            className="w-72 rounded-[3px] border border-[rgba(255,255,255,0.15)] bg-[#0d0d14] px-3 py-2 text-sm text-[#f0f0f0]"
          />
        </div>
      ))}
      <Button variant={variant} size="sm" disabled={disabled} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}

export function AdminTransactions() {
  const { user: currentAdmin } = useAuth();
  const isSuperAdmin = hasMinRole(currentAdmin?.role, "super_admin");

  const [tradeLeagueId, setTradeLeagueId] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [waiverLeagueId, setWaiverLeagueId] = useState("");
  const [claimId, setClaimId] = useState("");
  const [transferId, setTransferId] = useState("");

  const vetoTrade = useVetoTrade();
  const cancelTrade = useCancelTrade();
  const cancelWaiverClaim = useCancelWaiverClaim();
  const reverseTransfer = useReverseTransfer();

  return (
    <div className="space-y-6">
      <h1 className="font-bebas text-4xl tracking-[2px] text-[#f0f0f0]">Transactions</h1>
      <p className="text-xs text-[#555560]">
        IDs for trades, waiver claims, and transfers can be found via the audit log or a league&apos;s own
        management pages.
      </p>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
        <p className="section-label">Trades</p>
        <IdForm
          fields={[
            { label: "League ID", value: tradeLeagueId, onChange: setTradeLeagueId },
            { label: "Trade ID", value: tradeId, onChange: setTradeId },
          ]}
          submitLabel="Veto Trade"
          disabled={!tradeLeagueId || !tradeId || vetoTrade.isPending}
          onSubmit={() => vetoTrade.mutate({ leagueId: tradeLeagueId, tradeId })}
        />
        <IdForm
          fields={[
            { label: "League ID", value: tradeLeagueId, onChange: setTradeLeagueId },
            { label: "Trade ID", value: tradeId, onChange: setTradeId },
          ]}
          submitLabel="Force Cancel Trade"
          variant="danger"
          disabled={!tradeLeagueId || !tradeId || cancelTrade.isPending}
          onSubmit={() => {
            if (window.confirm("Force-cancel this trade regardless of who proposed it?")) {
              cancelTrade.mutate({ leagueId: tradeLeagueId, tradeId });
            }
          }}
        />
      </section>

      <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
        <p className="section-label">Waivers</p>
        <IdForm
          fields={[
            { label: "League ID", value: waiverLeagueId, onChange: setWaiverLeagueId },
            { label: "Claim ID", value: claimId, onChange: setClaimId },
          ]}
          submitLabel="Force Cancel Claim"
          variant="danger"
          disabled={!waiverLeagueId || !claimId || cancelWaiverClaim.isPending}
          onSubmit={() => cancelWaiverClaim.mutate({ leagueId: waiverLeagueId, claimId })}
        />
      </section>

      {isSuperAdmin && (
        <section className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 space-y-3">
          <p className="section-label">Transfers</p>
          <IdForm
            fields={[{ label: "Transfer ID", value: transferId, onChange: setTransferId }]}
            submitLabel="Reverse Transfer"
            variant="danger"
            disabled={!transferId || reverseTransfer.isPending}
            onSubmit={() => {
              if (
                window.confirm(
                  "Reverse this transfer? This restores the prior roster and budget state and cannot be undone.",
                )
              ) {
                reverseTransfer.mutate({ transferId });
              }
            }}
          />
        </section>
      )}
    </div>
  );
}
