"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toastifier } from "@/libs/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { KickMemberModal } from "@/components/dashboard/leagues/league-members/components/KickMemberModal";
import { MemberList } from "@/components/dashboard/leagues/league-members/components/MemberList";
import type { Member } from "@/components/dashboard/leagues/league-members/components/MemberCard";

const initialMembers: Member[] = [
  { id: 1, name: "John Doe", teamName: "Goal Rush", joinDate: "2025-01-01", totalPoints: 212 },
  { id: 2, name: "Mike T.", teamName: "Dunk FC", joinDate: "2025-01-02", totalPoints: 245 },
  { id: 3, name: "Sarah K.", teamName: "FC United", joinDate: "2025-01-03", totalPoints: 198 },
  { id: 4, name: "Alex R.", teamName: "City FC", joinDate: "2025-01-04", totalPoints: 187 },
];

export function LeagueMembers() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";
  const selfId = 1;
  const commissionerId = 1;

  const [query, setQuery] = useState("");
  const [members, setMembers] = useState(initialMembers);
  const [isKicking, setIsKicking] = useState(false);
  const [targetMember, setTargetMember] = useState<Member | null>(null);

  const filteredMembers = useMemo(() => {
    const lower = query.trim().toLowerCase();
    if (!lower) {
      return members;
    }

    return members.filter((member) =>
      member.name.toLowerCase().includes(lower) || member.teamName.toLowerCase().includes(lower),
    );
  }, [members, query]);

  const confirmKick = async () => {
    if (!targetMember) {
      return;
    }

    setIsKicking(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setMembers((prev) => prev.filter((member) => member.id !== targetMember.id));
    setIsKicking(false);
    toastifier.success(`✓ ${targetMember.name} removed from league`);
    setTargetMember(null);
  };

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <NavigationTabs activeTab="members" leagueId={leagueId} isCommissioner={isCommissioner} />

      <div className="rounded-2xl border border-gray-100 bg-white p-5">
        <h2 className="text-lg font-medium text-gray-900">League Members</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by member or team name"
          className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-gray-900 outline-none focus:border-primary-400"
        />
      </div>

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
