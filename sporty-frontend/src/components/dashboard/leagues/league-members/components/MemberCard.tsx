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
    <article className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20 text-sm font-medium text-foreground">
            {initials(member.name)}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {member.name}{" "}
              {isCommissionerMember ? <span className="ml-1">👑</span> : null}
            </p>
            <p className="text-xs text-foreground/55">{member.teamName}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {member.totalPoints ?? 0} pts
          </p>
          <p className="text-xs text-foreground/55">Joined {member.joinDate}</p>
        </div>
      </div>

      {canKick ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => onKick(member)}
            className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-100 transition-colors hover:bg-red-500/15"
          >
            Kick
          </button>
        </div>
      ) : null}
    </article>
  );
}

export type { Member };
