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
    return `${origin}/join?code=${encodeURIComponent(inviteCode)}`;
  }, [inviteCode]);

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
      <NavigationTabs
        activeTab="invite"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
        <h2 className="text-lg text-[#f0f0f0]">Invite Friends</h2>
        {isPublicLeague ? (
          <p className="mt-1 text-sm text-[#555560]">
            This league is public - anyone can join. Share this link with
            friends.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[#555560]">
            Share this code or link to invite new members to your league.
          </p>
        )}
      </div>

      {!isPublicLeague && inviteCode ? (
        <InviteCodeDisplay inviteCode={inviteCode} />
      ) : null}
      <ShareLinks shareUrl={shareUrl} />
    </section>
  );
}
