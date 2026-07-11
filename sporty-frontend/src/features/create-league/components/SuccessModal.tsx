"use client";

import { ArrowRight, Plus, Share2 } from "lucide-react";
import { SuccessModal as SuccessModalShell } from "@/components/ui";
import { InviteCodeDisplay } from "./InviteCodeDisplay";
import { toastifier } from "@/lib/toastifier";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  leagueName: string;
  inviteCode: string;
  isPrivate: boolean;
};

export function SuccessModal({
  isOpen,
  onClose,
  leagueId,
  leagueName,
  inviteCode,
  isPrivate,
}: SuccessModalProps) {
  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/join-league?code=${inviteCode}`;

    try {
      await navigator.clipboard.writeText(inviteLink);
      toastifier.success("Invite link copied");
    } catch {
      toastifier.error("Unable to copy invite link");
    }
  };

  return (
    <SuccessModalShell
      open={isOpen}
      onClose={onClose}
      eyebrow="League Created"
      title={leagueName}
      actions={[
        {
          label: "Go to League",
          icon: ArrowRight,
          href: `/leagues/${leagueId}`,
          variant: "primary",
        },
        {
          label: "Invite Friends",
          icon: Share2,
          onClick: handleCopyInviteLink,
          variant: "secondary",
        },
        {
          label: "Create Another League",
          icon: Plus,
          onClick: onClose,
          variant: "tertiary",
        },
      ]}
    >
      {isPrivate ? (
        <div>
          <p className="section-label mb-2">Invite Code</p>
          <InviteCodeDisplay inviteCode={inviteCode} />
          <p className="mt-2 text-xs text-fg-3">
            Share this code or the invite link so friends can join.
          </p>
        </div>
      ) : (
        <div className="rounded-[3px] border border-white/8 bg-surface-2 px-4 py-3">
          <p className="font-sans text-sm font-700 uppercase tracking-[1px] text-fg-2">
            Public League
          </p>
          <p className="mt-1 text-xs text-fg-3">
            Anyone can find and join this league from the browse page.
          </p>
        </div>
      )}
    </SuccessModalShell>
  );
}
