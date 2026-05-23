"use client";

import { useTransfersDashboard, TransfersView } from "@/features/transfers";

export function Transfers() {
  const vm = useTransfersDashboard();
  return <TransfersView {...vm} />;
}
