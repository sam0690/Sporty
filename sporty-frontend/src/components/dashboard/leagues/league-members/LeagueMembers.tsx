"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toastifier } from "@/lib/toastifier";
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
    memberships?.find(
      (m) => m.user.username === username && m.status === "active",
    )?.id ?? "";
  const commissionerId =
    memberships?.find(
      (m) =>
        m.user.username === league?.owner?.username && m.status === "active",
    )?.id ?? "";

  const [query, setQuery] = useState("");
  const [isKicking, setIsKicking] = useState(false);
  const [targetMember, setTargetMember] = useState<Member | null>(null);

  const members: Member[] = useMemo(
    () =>
      (memberships ?? []).map((membership) => ({
        id: membership.id,
        name: membership.user.username,
        status: membership.status,
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
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
      <NavigationTabs
        activeTab="members"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
        <h2 className="text-lg text-[#f0f0f0]">League Members</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by member or team name"
          className="mt-4 w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2.5 text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        />
      </div>

      {isLoading ? (
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 text-sm text-[#555560] ">
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
