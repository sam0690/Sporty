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
      })),
    [memberships],
  );

  const activeCount = useMemo(
    () => members.filter((m) => m.status === "active").length,
    [members],
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
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#0B1220]">
      <NavigationTabs
        activeTab="members"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[rgba(11,18,32,0.08)] pb-6">
        <div>
          <p className="section-label">{league?.name || "League"}</p>
          <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
            Members
          </h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Everyone competing in this league
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="font-bebas text-4xl leading-none tracking-[2px] text-[#DC2626]">
              {members.length}
            </p>
            <p className="section-label mt-1">Total</p>
          </div>
          <div className="text-right">
            <p className="font-bebas text-4xl leading-none tracking-[2px] text-[#0B1220]">
              {activeCount}
            </p>
            <p className="section-label mt-1">Active</p>
          </div>
        </div>
      </header>

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]">
          ⌕
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by member or team name"
          className="w-full rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] py-2.5 pl-10 pr-4 text-sm text-[#0B1220] outline-none transition-colors focus:border-[#DC2626]"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-[3px] bg-[#F3F4F7]"
            />
          ))}
        </div>
      ) : (
        <MemberList
          members={filteredMembers}
          commissionerId={commissionerId}
          selfId={selfId}
          isCommissioner={isCommissioner}
          onKick={setTargetMember}
        />
      )}

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
