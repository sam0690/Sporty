"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AdminDetailSkeleton } from "@/components/dashboard/admin/AdminDetailSkeleton";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { useTicket, useAddTicketMessage } from "@/hooks/support/useSupportTickets";

export function SupportTicketDetail({ ticketId }: { ticketId: string }) {
  const { data: ticket, isLoading, isError, refetch } = useTicket(ticketId);
  const addMessage = useAddTicketMessage(ticketId);
  const [reply, setReply] = useState("");

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
          {ticket.category.replaceAll("_", " ")} · Status:{" "}
          <span className="uppercase">{ticket.status.replaceAll("_", " ")}</span>
        </p>
      </div>

      <section className="space-y-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className="card-surface p-4">
            <p className="text-xs text-fg-3 mb-1">{new Date(m.created_at).toLocaleString()}</p>
            <p className="text-sm text-fg-1 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </section>

      {ticket.status !== "closed" && (
        <section className="card-surface p-5 space-y-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a reply…"
            rows={3}
            className="w-full rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={!reply || addMessage.isPending}
            onClick={() => addMessage.mutate(reply, { onSuccess: () => setReply("") })}
          >
            Send
          </Button>
        </section>
      )}
    </div>
  );
}
