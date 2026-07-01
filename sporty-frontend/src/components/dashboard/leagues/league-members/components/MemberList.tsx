"use client";

import { Users } from "lucide-react";
import {
  MemberCard,
  type Member,
} from "@/components/dashboard/leagues/league-members/components/MemberCard";

type MemberListProps = {
  members: Member[];
  commissionerId: string;
  selfId: string;
  isCommissioner: boolean;
  onKick: (member: Member) => void;
};

export function MemberList({
  members,
  commissionerId,
  selfId,
  isCommissioner,
  onKick,
}: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="surface flex flex-col items-center p-8 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
          aria-hidden
        >
          <Users className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <p className="mt-3 font-condensed text-sm font-bold uppercase tracking-[0.06em] text-ink">
          No members found
        </p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Invite friends to fill out your league.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          isCommissionerMember={member.id === commissionerId}
          canKick={
            isCommissioner && member.id !== selfId && member.status === "active"
          }
          onKick={onKick}
        />
      ))}
    </div>
  );
}
