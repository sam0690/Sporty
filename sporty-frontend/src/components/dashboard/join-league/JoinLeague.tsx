"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { ErrorAlert } from "@/components/dashboard/join-league/components/ErrorAlert";
import { JoinForm } from "@/components/dashboard/join-league/components/JoinForm";
import { PublicLeaguesList, type PublicLeague } from "@/components/dashboard/join-league/components/PublicLeaguesList";
import { SuccessModal, type JoinedLeague } from "@/components/dashboard/join-league/components/SuccessModal";
import { CardSkeleton } from "@/components/ui/skeletons";

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
    <section className="max-w-4xl mx-auto px-6 py-12 space-y-8 text-gray-900 [font-family:system-ui,-apple-system]">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-light tracking-tight text-gray-900">Join a League</h1>
        <p className="mt-2 text-gray-500">Enter an invite code to join an existing league</p>
      </header>

      {error ? <ErrorAlert message={error} onDismiss={() => setError(null)} /> : null}

      {isLoading ? (
        <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-gray-100 bg-white p-8">
          <CardSkeleton />
          <div className="h-10 animate-pulse rounded-full bg-gray-100" />
        </div>
      ) : (
        <JoinForm onSubmit={handleSubmit} isLoading={isLoading} error={null} />
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-widest text-gray-400">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <PublicLeaguesList leagues={publicLeagues} onJoin={handleJoinPublicLeague} />

      <div className="text-center text-sm">
        <Link href="/create-league" className="text-gray-500 transition-colors hover:text-primary-600">
          Don't have a league? Create one →
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
