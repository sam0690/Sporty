"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { ErrorAlert } from "./ErrorAlert";
import { JoinForm } from "./JoinForm";
import {
  PublicLeaguesList,
  type PublicLeague,
} from "./PublicLeaguesList";
import {
  SuccessModal,
  type JoinedLeague,
} from "./SuccessModal";
import { CardSkeleton } from "@/components/ui/skeletons";
import { useJoinLeague, useDiscoverLeagues } from "@/hooks/leagues/useLeagues";
import type { TLeague } from "@/types";

export function JoinLeagueView() {
  const { username } = useMe();
  const { data: discoverLeagues, isLoading: discoverLoading } =
    useDiscoverLeagues();
  const joinMutation = useJoinLeague();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams?.get("code") ?? "";

  const [successData, setSuccessData] = useState<JoinedLeague | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoJoinAttempted = useRef(false);

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

  useEffect(() => {
    if (!codeFromUrl || autoJoinAttempted.current) {
      return;
    }
    autoJoinAttempted.current = true;
    void handleSubmit(codeFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

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
    <section className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-fg-1 sm:px-6 sm:py-12">
      <header className="text-center">
        <span className="section-label">Leagues</span>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Join a League
        </h1>
        <p className="mt-2 text-sm text-fg-2">
          Enter an invite code, or pick a public league to jump straight in.
        </p>
      </header>

      {error ? (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      ) : null}

      {isLoading ? (
        <div className="mx-auto max-w-md space-y-3 card-surface p-8">
          <CardSkeleton />
          <div className="h-11 animate-pulse rounded-[3px] bg-surface-3" />
        </div>
      ) : (
        <JoinForm
          onSubmit={handleSubmit}
          isLoading={joinMutation.isPending}
          error={error}
          defaultInviteCode={codeFromUrl}
        />
      )}

      <div className="mx-auto flex max-w-2xl items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-sans text-[10px] font-700 uppercase tracking-[2px] text-fg-3">
          or browse public leagues
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <PublicLeaguesList
        leagues={publicLeagues}
        onJoin={handleJoinPublicLeague}
      />

      <div className="text-center">
        <Link
          href="/create-league"
          className="font-sans text-xs font-700 uppercase tracking-[2px] text-fg-3 transition-colors hover:text-accent hover:no-underline"
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
