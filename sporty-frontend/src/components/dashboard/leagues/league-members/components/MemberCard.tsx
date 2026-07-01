"use client";

import { Crown } from "lucide-react";

type Member = {
  id: string;
  name: string;
  teamName: string;
  joinDate: string;
  status: "active" | "left";
  totalPoints?: number;
};

type MemberCardProps = {
  member: Member;
  isCommissionerMember: boolean;
  canKick: boolean;
  onKick: (member: Member) => void;
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

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
          ? "border-white/5 bg-[#FFFFFF] opacity-70"
          : "border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] hover:border-[rgba(220,38,38,0.2)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] font-bebas text-lg tracking-[1px] ${
              isCommissionerMember
                ? "bg-[rgba(220,38,38,0.18)] text-[#DC2626]"
                : "bg-[rgba(11,18,32,0.06)] text-[#0B1220]"
            }`}
          >
            {initials(member.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
              {member.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#6B7280]">
              {member.teamName}
            </p>
            {isCommissionerMember ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-sm bg-primary-soft px-1.5 py-0.5 font-condensed text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                <Crown className="h-3 w-3" />
                Commissioner
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] ${
            isLeftMember
              ? "border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280]"
              : "border border-[rgba(220,38,38,0.25)] bg-[rgba(220,38,38,0.08)] text-[#B91C1C]"
          }`}
        >
          {isLeftMember ? "Left" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[rgba(11,18,32,0.06)] pt-3">
        <p className="section-label">Joined {member.joinDate}</p>
        {canKick ? (
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-transparent px-3 py-1 font-barlow-condensed text-[10px] font-bold uppercase tracking-[1.5px] text-[#DC2626] transition-colors hover:bg-[rgba(255,59,48,0.1)]"
          >
            Kick
          </button>
        ) : null}
      </div>
    </article>
  );
}

export type { Member };
