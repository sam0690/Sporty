"use client";

type Member = {
  id: number;
  name: string;
  teamName: string;
  joinDate: string;
  totalPoints: number;
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

export function MemberCard({ member, isCommissionerMember, canKick, onKick }: MemberCardProps) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-700">
            {initials(member.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {member.name} {isCommissionerMember ? <span className="ml-1">👑</span> : null}
            </p>
            <p className="text-xs text-gray-500">{member.teamName}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{member.totalPoints} pts</p>
          <p className="text-xs text-gray-500">Joined {member.joinDate}</p>
        </div>
      </div>

      {canKick ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-full border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Kick
          </button>
        </div>
      ) : null}
    </article>
  );
}

export type { Member };
