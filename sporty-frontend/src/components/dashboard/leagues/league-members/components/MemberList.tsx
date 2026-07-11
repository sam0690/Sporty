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
      <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-8 text-center">
        <Users className="mx-auto h-6 w-6 text-[#555560]" aria-hidden />
        <p className="mt-2 font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          No members found
        </p>
        <p className="mt-1 text-sm text-[#555560]">
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
