"use client";

import { use } from "react";
import { AdminTicketDetail } from "@/features/admin/components/AdminTicketDetail";

export default function AdminTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const resolvedParams = use(params);
  return <AdminTicketDetail ticketId={resolvedParams.ticketId} />;
}
