"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/Button";
import { AdminDetailSkeleton } from "./AdminDetailSkeleton";
import { AdminErrorState } from "./AdminErrorState";
import { useAdminTicket, useUpdateTicket, useAddAdminTicketMessage } from "@/hooks/admin/useAdminTickets";
import type { TTicketPriority, TTicketStatus } from "@/services/SupportService";

const STATUS_OPTIONS: TTicketStatus[] = ["open", "in_progress", "waiting_on_user", "resolved", "closed"];
const PRIORITY_OPTIONS: TTicketPriority[] = ["low", "normal", "high", "urgent"];

export function AdminTicketDetail({ ticketId }: { ticketId: string }) {
  const { user: currentAdmin } = useAuth();
  const { data: ticket, isLoading, isError, refetch } = useAdminTicket(ticketId);
  const updateTicket = useUpdateTicket(ticketId);
  const addMessage = useAddAdminTicketMessage(ticketId);

  const [reply, setReply] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  if (isLoading) {
    return <AdminDetailSkeleton />;
  }

  if (isError) {
    return <AdminErrorState onRetry={() => refetch()} />;
  }

  if (!ticket) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">{ticket.subject}</h1>
        <p className="text-xs text-fg-3 mt-1">
          Reported by {ticket.reporter_username} · {ticket.category.replaceAll("_", " ")}
        </p>
      </div>

      <section className="card-surface p-5 flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg-3">Status</label>
          <select
            value={ticket.status}
            onChange={(e) => updateTicket.mutate({ status: e.target.value as TTicketStatus })}
            className="rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-sm text-fg-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg-3">Priority</label>
          <select
            value={ticket.priority}
            onChange={(e) => updateTicket.mutate({ priority: e.target.value as TTicketPriority })}
            className="rounded-[3px] border border-white/15 bg-surface-2 px-2 py-1 text-sm text-fg-1"
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-fg-3">Assigned to</label>
          {ticket.assigned_admin_username ? (
            <span className="text-sm text-fg-1">{ticket.assigned_admin_username}</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={updateTicket.isPending}
              onClick={() => currentAdmin && updateTicket.mutate({ assigned_admin_user_id: currentAdmin.id })}
            >
              Assign to me
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-[3px] border p-4 ${
              m.is_internal_note
                ? "border-accent/30 bg-accent/5"
                : "border-white/8 bg-surface-1"
            }`}
          >
            <p className="text-xs text-fg-3 mb-1">
              {new Date(m.created_at).toLocaleString()}
              {m.is_internal_note && <span className="ml-2 text-accent">Internal note</span>}
            </p>
            <p className="text-sm text-fg-1 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </section>

      <section className="card-surface p-5 space-y-3">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply…"
          rows={3}
          className="w-full rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
        />
        <label className="flex items-center gap-2 text-xs text-fg-3">
          <input
            type="checkbox"
            checked={isInternalNote}
            onChange={(e) => setIsInternalNote(e.target.checked)}
          />
          Internal note (not visible to the reporter)
        </label>
        <Button
          variant="primary"
          size="sm"
          disabled={!reply || addMessage.isPending}
          onClick={() =>
            addMessage.mutate(
              { body: reply, isInternalNote },
              { onSuccess: () => setReply("") },
            )
          }
        >
          Send
        </Button>
      </section>
    </div>
  );
}
