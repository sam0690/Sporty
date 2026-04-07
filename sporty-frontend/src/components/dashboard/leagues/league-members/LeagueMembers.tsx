"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toastifier } from "@/libs/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { KickMemberModal } from "@/components/dashboard/leagues/league-members/components/KickMemberModal";
import { MemberList } from "@/components/dashboard/leagues/league-members/components/MemberList";
import type { Member } from "@/components/dashboard/leagues/league-members/components/MemberCard";
import { useLeague, useLeagueMembers } from "@/hooks/leagues/useLeagues";
import { useMe } from "@/hooks/auth/useMe";

export function LeagueMembers() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { data: memberships, isLoading } = useLeagueMembers(leagueId);

  const isCommissioner = league?.owner?.username === username;
  const selfId =
    memberships?.find((m) => m.user.username === username)?.id ?? "";
  const commissionerId =
    memberships?.find((m) => m.user.username === league?.owner?.username)?.id ??
    "";

  const [query, setQuery] = useState("");
  const [isKicking, setIsKicking] = useState(false);
  const [targetMember, setTargetMember] = useState<Member | null>(null);

  const members: Member[] = useMemo(
    () =>
      (memberships ?? []).map((membership) => ({
        id: membership.id,
        name: membership.user.username,
        teamName: membership.draft_position
          ? `Draft Position #${membership.draft_position}`
          : "Team pending",
        joinDate: new Date(membership.joined_at).toLocaleDateString(),
        totalPoints: 0,
      })),
    [memberships],
  );

  const filteredMembers = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return members;
    }

    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(lower) ||
        member.teamName.toLowerCase().includes(lower),
    );
  }, [members, query]);

  const confirmKick = async () => {
    if (!targetMember) {
      return;
    }

    setIsKicking(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setIsKicking(false);
    toastifier.info(
      "Member removal endpoint is not implemented yet in backend",
    );
    setTargetMember(null);
  };

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 space-y-6 font-[system-ui,-apple-system] text-gray-900">
      <NavigationTabs
        activeTab="members"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="text-lg font-medium text-gray-900">League Members</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by member or team name"
          className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 text-sm text-gray-600">
          Loading members...
        </div>
      ) : null}

      <MemberList
        members={filteredMembers}
        commissionerId={commissionerId}
        selfId={selfId}
        isCommissioner={isCommissioner}
        onKick={setTargetMember}
      />

      <KickMemberModal
        isOpen={Boolean(targetMember)}
        memberName={targetMember?.name ?? ""}
        isKicking={isKicking}
        onClose={() => setTargetMember(null)}
        onConfirm={confirmKick}
      />
    </section>
  );
}
