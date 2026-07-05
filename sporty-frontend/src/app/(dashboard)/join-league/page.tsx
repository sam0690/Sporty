"use client";

import { Suspense } from "react";
import { JoinLeague } from "@/components/dashboard/join-league";

export default function JoinLeaguePage() {
  return (
    <Suspense fallback={null}>
      <JoinLeague />
    </Suspense>
  );
}
