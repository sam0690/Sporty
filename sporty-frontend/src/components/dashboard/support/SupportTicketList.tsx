"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { TableSkeleton } from "@/components/ui/skeletons/TableSkeleton";
import { Table, type TableColumn } from "@/components/ui";
import { AdminErrorState } from "@/components/dashboard/admin/AdminErrorState";
import { useMyTickets, useCreateTicket } from "@/hooks/support/useSupportTickets";
import type { TTicket, TTicketCategory } from "@/services/SupportService";

const CATEGORY_OPTIONS: TTicketCategory[] = ["account", "league_dispute", "transfer_dispute", "billing", "bug", "other"];

export function SupportTicketList() {
  const { data, isLoading, isError, refetch } = useMyTickets();
  const createTicket = useCreateTicket();

  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TTicketCategory>("other");
  const [body, setBody] = useState("");

  const columns: TableColumn<TTicket>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <Link href={`/support/${t.id}`} className="text-fg-1 hover:underline">
          {t.subject}
        </Link>
      ),
    },
    { key: "category", header: "Category", render: (t) => t.category.replaceAll("_", " ") },
    { key: "status", header: "Status", render: (t) => <span className="uppercase tracking-[1px] text-xs">{t.status.replaceAll("_", " ")}</span> },
    { key: "created_at", header: "Opened", render: (t) => new Date(t.created_at).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Support</h1>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New Ticket"}
        </Button>
      </div>

      {showForm && (
        <section className="card-surface p-5 space-y-3">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TTicketCategory)}
            className="rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1"
          >
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the issue…"
            rows={4}
            className="w-full rounded-[3px] border border-white/15 bg-surface-2 px-3 py-2 text-sm text-fg-1 placeholder:text-fg-3"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={!subject || !body || createTicket.isPending}
            onClick={() =>
              createTicket.mutate(
                { subject, category, body },
                { onSuccess: () => { setShowForm(false); setSubject(""); setBody(""); } },
              )
            }
          >
            Submit
          </Button>
        </section>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <AdminErrorState onRetry={() => refetch()} />
      ) : data ? (
        <Table columns={columns} rows={data.items} rowKey={(t) => t.id} emptyMessage="No support tickets yet." />
      ) : null}
    </div>
  );
}
