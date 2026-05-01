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

export function JoinLeague() {
  const { username } = useMe();
  const { data: discoverLeagues, isLoading: discoverLoading } =
    useDiscoverLeagues();
  const joinMutation = useJoinLeague();

  const [successData, setSuccessData] = useState<JoinedLeague | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (inviteCode: string) => {
    setError(null);
    if (!inviteCode) {
      setError("Invite code is required");
      return;
    }

    try {
      await joinMutation.mutateAsync(inviteCode);
      setSuccessData({
        name: "Joined League",
        sport: "football",
        teamName: `${username || "Sporty"} Team`,
      });
      setShowSuccessModal(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Unable to join league");
        return;
      }
      setError("Unable to join league");
    }
  };

  const handleJoinPublicLeague = async (league: PublicLeague) => {
    if (league.requiresInviteCode) {
      setError("This league requires an invite code.");
      return;
    }
    if (league.joinableNow === false) {
      setError("This league is not accepting new members right now.");
      return;
    }
    // For public leagues without codes, we'd need a direct join endpoint or use an invite code if provided
    if (league.inviteCode) {
      await handleSubmit(league.inviteCode);
    }
  };

  const publicLeagues: PublicLeague[] = (discoverLeagues || []).map(
    (l: TLeague) => ({
      id: l.id,
      name: l.name,
      sport:
        (l.sports?.[0]?.sport.name as PublicLeague["sport"]) || "multisport",
      memberCount: l.member_count ?? 0,
      requiresInviteCode: !l.is_public,
      joinableNow: l.joinable_now ?? true,
      joinMessage: l.midseason_join_message ?? undefined,
      midseasonEntryWindowNumber: l.midseason_entry_window_number ?? null,
      inviteCode: l.invite_code,
    }),
  );

  const isLoading = discoverLoading || joinMutation.isPending;

  return (
    <section className="max-w-4xl mx-auto px-6 py-12 space-y-8 text-black font-[system-ui,-apple-system]">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Join a League
        </h1>
        <p className="mt-2 text-secondary">
          Enter an invite code to join an existing league
        </p>
      </header>

      {error ? (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? (
        <div className="mx-auto max-w-md space-y-3 rounded-lg border border-accent/20 bg-white p-8">
          <CardSkeleton />
          <div className="h-10 animate-pulse rounded-full bg-accent/20" />
        </div>
      ) : (
        <JoinForm
          onSubmit={handleSubmit}
          isLoading={joinMutation.isPending}
          error={error}
        />
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="h-px flex-1 bg-accent/30" />
        <span className="text-xs uppercase tracking-widest text-secondary/60">
          or
        </span>
        <div className="h-px flex-1 bg-accent/30" />
      </div>

      <PublicLeaguesList
        leagues={publicLeagues}
        onJoin={handleJoinPublicLeague}
      />

      <div className="text-center text-sm">
        <Link
          href="/create-league"
          className="text-secondary transition-colors hover:text-primary"
        >
          Don&apos;t have a league? Create one →
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
