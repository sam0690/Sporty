"use client";

import { Suspense } from "react";
import { JoinLeagueView, useJoinLeagueDashboard } from "@/features/join-league";

function JoinLeagueContent() {
  const vm = useJoinLeagueDashboard();
  return <JoinLeagueView {...vm} />;
}

export default function JoinLeaguePage() {
  return (
    <Suspense fallback={null}>
      <JoinLeagueContent />
    </Suspense>
  );
}
