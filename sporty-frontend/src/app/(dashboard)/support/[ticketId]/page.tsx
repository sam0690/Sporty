"use client";

import { use } from "react";
import { SupportTicketDetail } from "@/components/dashboard/support/SupportTicketDetail";

export default function SupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const resolvedParams = use(params);
  return <SupportTicketDetail ticketId={resolvedParams.ticketId} />;
}
