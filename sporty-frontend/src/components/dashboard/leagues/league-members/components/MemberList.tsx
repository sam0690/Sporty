"use client";

import { MemberCard, type Member } from "@/components/dashboard/leagues/league-members/components/MemberCard";

type MemberListProps = {
  members: Member[];
  commissionerId: number;
  selfId: number;
  isCommissioner: boolean;
  onKick: (member: Member) => void;
};

export function MemberList({ members, commissionerId, selfId, isCommissioner, onKick }: MemberListProps) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          isCommissionerMember={member.id === commissionerId}
          canKick={isCommissioner && member.id !== selfId}
          onKick={onKick}
        />
      ))}
    </div>
  );
}
