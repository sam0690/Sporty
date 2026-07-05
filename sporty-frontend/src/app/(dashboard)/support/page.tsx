"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// import { SupportTicketList } from "@/components/dashboard/support/SupportTicketList";

// Support is disabled for users right now — redirect back to the dashboard
// instead of exposing the ticket UI. Re-enable by restoring the import above
// and the commented-out return below.
export default function SupportPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
  // return <SupportTicketList />;
}
