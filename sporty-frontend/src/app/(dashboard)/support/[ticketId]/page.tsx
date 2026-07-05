"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// import { use } from "react";
// import { SupportTicketDetail } from "@/components/dashboard/support/SupportTicketDetail";

// Support is disabled for users right now — redirect back to the dashboard
// instead of exposing the ticket UI. Re-enable by restoring the imports and
// the commented-out body below.
export default function SupportTicketPage({
  params: _params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
  // const resolvedParams = use(params);
  // return <SupportTicketDetail ticketId={resolvedParams.ticketId} />;
}
