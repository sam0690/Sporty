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
          ? "border-white/5 bg-surface-1 opacity-70"
          : "border-white/8 bg-surface-1 hover:border-accent/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar name={member.name} photoUrl={member.avatarUrl} size="md" className="shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-fg-1">
              {member.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-fg-3">
              {member.teamName}
            </p>
            {isCommissionerMember ? (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-[3px] bg-accent/12 px-1.5 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] text-accent">
                <Crown className="h-3 w-3" />
                Commissioner
              </span>
            ) : null}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${
            isLeftMember
              ? "border border-white/8 bg-surface-3 text-fg-2"
              : "border border-accent/25 bg-accent/8 text-accent-dim"
          }`}
        >
          {isLeftMember ? "Left" : "Active"}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-3">
        <p className="section-label">Joined {member.joinDate}</p>
        {canKick ? (
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-transparent px-3 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] text-danger transition-colors hover:bg-[rgba(255,59,48,0.1)]"
          >
            Kick
          </button>
        ) : null}
      </div>
    </article>
  );
}

export type { Member };
