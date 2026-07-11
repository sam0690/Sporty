"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { InviteCodeDisplay } from "@/components/dashboard/leagues/invite-friends/components/InviteCodeDisplay";
import { ShareLinks } from "@/components/dashboard/leagues/invite-friends/components/ShareLinks";
import { useMe } from "@/hooks/auth/useMe";
import { useLeague } from "@/hooks/leagues/useLeagues";
import type { TLeague } from "@/types";

type InviteLeagueShape = TLeague & {
  is_public?: boolean;
};

export function InviteFriends() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const inviteLeague = league as InviteLeagueShape | undefined;

  const isCommissioner = league?.owner?.username === username;
  const isPublicLeague = Boolean(inviteLeague?.is_public);
  const inviteCode = league?.invite_code ?? "";

  const shareUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://sporty.app";
    return `${origin}/join-league?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-fg-1">
      <NavigationTabs
        activeTab="invite"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <header className="border-b border-white/8 pb-6">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Invite Friends
        </h1>
        <p className="mt-1 text-sm text-fg-3">
          {isPublicLeague
            ? "This league is public — anyone with the link can join."
            : "Share this code or link to invite new members to your league."}
        </p>
      </header>

      {!isPublicLeague && inviteCode ? (
        <InviteCodeDisplay inviteCode={inviteCode} />
      ) : null}
      <ShareLinks shareUrl={shareUrl} />
    </section>
  );
}
