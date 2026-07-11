"use client";

import { Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/ui";

type Member = {
  id: string;
  name: string;
  teamName: string;
  joinDate: string;
  status: "active" | "left";
  totalPoints?: number;
  avatarUrl?: string | null;
};

type MemberCardProps = {
  member: Member;
  isCommissionerMember: boolean;
  canKick: boolean;
  onKick: (member: Member) => void;
};

export function MemberCard({
  member,
  isCommissionerMember,
  canKick,
  onKick,
}: MemberCardProps) {
  const isLeftMember = member.status === "left";

  return (
    <article
      className={`group rounded-[3px] border p-4 transition-colors animate-fade-soft ${
        isLeftMember
          ? "border-white/5 bg-[#111117] opacity-70"
          : "border-[rgba(255,255,255,0.08)] bg-[#111117] hover:border-[rgba(232,251,37,0.2)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={member.name} photoUrl={member.avatarUrl} size="md" className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
              {member.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#555560]">
              {member.teamName}
            </p>
            {isCommissionerMember ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-[3px] bg-[rgba(232,251,37,0.12)] px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-[#e8fb25]">
                <Crown className="h-3 w-3" />
                Commissioner
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${
            isLeftMember
              ? "border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5]"
              : "border border-[rgba(232,251,37,0.25)] bg-[rgba(232,251,37,0.08)] text-[#c8d85a]"
          }`}
        >
          {isLeftMember ? "Left" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-3">
        <p className="section-label">Joined {member.joinDate}</p>
        {canKick ? (
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-transparent px-3 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-[#ff3b30] transition-colors hover:bg-[rgba(255,59,48,0.1)]"
          >
            Kick
          </button>
        ) : null}
      </div>
    </article>
  );
}

export type { Member };
