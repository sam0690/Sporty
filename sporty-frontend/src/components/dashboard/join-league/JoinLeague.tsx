"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { ErrorAlert } from "@/components/dashboard/join-league/components/ErrorAlert";
import { JoinForm } from "@/components/dashboard/join-league/components/JoinForm";
import {
  PublicLeaguesList,
  type PublicLeague,
} from "@/components/dashboard/join-league/components/PublicLeaguesList";
import {
  SuccessModal,
  type JoinedLeague,
} from "@/components/dashboard/join-league/components/SuccessModal";
import { CardSkeleton } from "@/components/ui/skeletons";
import { useJoinLeague, useDiscoverLeagues } from "@/hooks/leagues/useLeagues";
import type { TLeague } from "@/types";

import { JoinLeagueView, useJoinLeagueDashboard } from "@/features/join-league";

export function JoinLeague() {
  const vm = useJoinLeagueDashboard();
  return <JoinLeagueView {...vm} />;
}
