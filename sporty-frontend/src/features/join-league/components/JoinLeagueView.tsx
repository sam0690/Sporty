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

export function JoinLeagueView() {
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
      joinableNow: l.joinable_now,
      joinMessage: l.midseason_join_message ?? undefined,
      midseasonEntryWindowNumber: l.midseason_entry_window_number ?? null,
      inviteCode: l.invite_code,
    }),
  );

  const isLoading = discoverLoading || joinMutation.isPending;

  return (
    <section className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-[#f0f0f0] sm:px-6 sm:py-12">
      <header className="text-center">
        <span className="section-label">Leagues</span>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-6xl">
          Join a League
        </h1>
        <p className="mt-2 text-sm text-[#9a9aa5]">
          Enter an invite code, or pick a public league to jump straight in.
        </p>
      </header>

      {error ? (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? (
        <div className="mx-auto max-w-md space-y-3 rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-gradient-to-b from-[#14141b] to-[#0f0f14] p-8">
          <CardSkeleton />
          <div className="h-11 animate-pulse rounded-[8px] bg-[#1d1d26]" />
        </div>
      ) : (
        <JoinForm
          onSubmit={handleSubmit}
          isLoading={joinMutation.isPending}
          error={error}
        />
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
        <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#555560]">
          or browse public leagues
        </span>
        <div className="h-px flex-1 bg-[rgba(255,255,255,0.1)]" />
      </div>

      <PublicLeaguesList
        leagues={publicLeagues}
        onJoin={handleJoinPublicLeague}
      />

      <div className="text-center">
        <Link
          href="/create-league"
          className="font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#e8fb25] hover:no-underline"
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
