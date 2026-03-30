"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ErrorAlert } from "@/components/dashboard/join-league/components/ErrorAlert";
import { JoinForm } from "@/components/dashboard/join-league/components/JoinForm";
import { LoadingState } from "@/components/dashboard/join-league/components/LoadingState";
import { PublicLeaguesList, type PublicLeague } from "@/components/dashboard/join-league/components/PublicLeaguesList";
import { SuccessModal, type JoinedLeague } from "@/components/dashboard/join-league/components/SuccessModal";

const validCodes: Record<string, JoinedLeague> = {
  "ABCD-1234-EFGH": { id: 1, name: "Premier League Champions", sport: "football", teamName: "Goal Rush" },
  "BASK-5678-BALL": { id: 2, name: "NBA Fantasy 2025", sport: "basketball", teamName: "Dunk Masters" },
  "CRIC-9012-KET": { id: 3, name: "Cricket World Cup", sport: "cricket", teamName: "Six Hitters" },
  "MULTI-3456-SPORT": { id: 4, name: "Ultimate All-Stars", sport: "multisport", teamName: "CrossSport Kings" },
};

const publicLeagues: PublicLeague[] = [
  { id: 11, name: "Weekend Football Clash", sport: "football", memberCount: 22, requiresInviteCode: false },
  { id: 12, name: "Open Hoops League", sport: "basketball", memberCount: 14, requiresInviteCode: false },
  { id: 13, name: "Elite Cricket Circle", sport: "cricket", memberCount: 10, requiresInviteCode: true },
  { id: 14, name: "Universal Legends", sport: "multisport", memberCount: 18, requiresInviteCode: false },
];

async function mockJoinLeague(inviteCode: string): Promise<{ success: true; league: JoinedLeague }> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const league = validCodes[inviteCode];
  if (league) {
    return { success: true, league };
  }

  if (inviteCode === "ALREADY-1111-MEMB") {
    throw new Error("You're already a member of this league");
  }

  if (inviteCode === "FULL-2222-LEAG") {
    throw new Error("This league is full");
  }

  throw new Error("Invalid invite code. Please check and try again.");
}

export function JoinLeague() {
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<JoinedLeague | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = async (inviteCode: string) => {
    setError(null);

    if (!inviteCode) {
      setError("Invite code is required");
      return;
    }

    const codeFormat = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!codeFormat.test(inviteCode)) {
      setError("Invalid format. Use XXXX-XXXX-XXXX");
      return;
    }

    try {
      setIsLoading(true);
      const result = await mockJoinLeague(inviteCode);
      setSuccessData(result.league);
      setShowSuccessModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to join league";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinPublicLeague = async (league: PublicLeague) => {
    if (league.requiresInviteCode) {
      setError("This league requires an invite code.");
      return;
    }

    setError(null);
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSuccessData({
      id: league.id,
      name: league.name,
      sport: league.sport,
      teamName: `${user?.name ?? "Sporty"} XI`,
      requiresTeamCreation: false,
    });
    setShowSuccessModal(true);
    setIsLoading(false);
  };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 text-text-primary">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Join a League</h1>
        <p className="mt-2 text-text-secondary">Enter an invite code to join an existing league</p>
      </header>

      <div className="mx-auto max-w-md rounded-lg bg-surface-100 p-8 shadow-card">
        {error ? <ErrorAlert message={error} onDismiss={() => setError(null)} /> : null}
        {isLoading ? (
          <LoadingState message="Validating invite code and joining league..." />
        ) : (
          <JoinForm onSubmit={handleSubmit} isLoading={isLoading} error={null} />
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-widest text-text-secondary">OR</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <PublicLeaguesList leagues={publicLeagues} onJoin={handleJoinPublicLeague} />

      <div className="text-center text-sm">
        <Link href="/create-league" className="text-primary-600 hover:underline">
          Want to start your own competition? Create New League
        </Link>
      </div>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        leagueData={successData}
      />
    </section>
  );
}
