"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { InviteCodeDisplay } from "@/components/dashboard/leagues/invite-friends/components/InviteCodeDisplay";
import { ShareLinks } from "@/components/dashboard/leagues/invite-friends/components/ShareLinks";

export function InviteFriends() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";
  const isPublicLeague = leagueId === "2";

  const inviteCode = useMemo(() => `SPRTY-${leagueId.toUpperCase()}-2025`, [leagueId]);
  const shareUrl = useMemo(
    () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://sporty.app";
      return `${origin}/join?code=${encodeURIComponent(inviteCode)}`;
    },
    [inviteCode],
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <NavigationTabs activeTab="invite" leagueId={leagueId} isCommissioner={isCommissioner} />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="text-lg font-medium text-gray-900">Invite Friends</h2>
        {isPublicLeague ? (
          <p className="mt-1 text-sm text-gray-600">
            This league is public - anyone can join. Share this link with friends.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            Share this code or link to invite new members to your league.
          </p>
        )}
      </div>

      {!isPublicLeague ? <InviteCodeDisplay inviteCode={inviteCode} /> : null}
      <ShareLinks shareUrl={shareUrl} />
    </section>
  );
}
