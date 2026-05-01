"use client";

type Member = {
  id: string;
  name: string;
  teamName: string;
  joinDate: string;
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
  return (
    <article className="rounded-lg border border-accent/20 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-black">
            {initials(member.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-black">
              {member.name}{" "}
              {isCommissionerMember ? <span className="ml-1">👑</span> : null}
            </p>
            <p className="text-xs text-secondary">{member.teamName}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-black">
            {member.totalPoints ?? 0} pts
          </p>
          <p className="text-xs text-secondary">Joined {member.joinDate}</p>
        </div>
      </div>

      {canKick ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-full border border-danger/20 px-3 py-1 text-xs text-danger hover:bg-danger/5"
          >
            Kick
          </button>
        </div>
      ) : null}
    </article>
  );
}

export type { Member };
