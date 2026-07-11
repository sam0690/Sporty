"use client";

import { ArrowRight, ListChecks, X } from "lucide-react";
import { SuccessModal as SuccessModalShell } from "@/components/ui";

type SuccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  leagueId: string;
  teamName: string;
};

export function SuccessModal({
  isOpen,
  onClose,
  leagueId,
  teamName,
}: SuccessModalProps) {
  return (
    <SuccessModalShell
      open={isOpen}
      onClose={onClose}
      eyebrow="Team Created"
      title={teamName}
      actions={[
        {
          label: "Go to League",
          icon: ArrowRight,
          href: `/leagues/${leagueId}`,
          variant: "primary",
        },
        {
          label: "Set Lineup",
          icon: ListChecks,
          href: `/leagues/${leagueId}/lineup`,
          variant: "secondary",
        },
        { label: "Close", icon: X, onClick: onClose, variant: "tertiary" },
      ]}
    >
      <p className="text-center text-xs text-fg-3">
        You&apos;re ready to start playing.
      </p>
    </SuccessModalShell>
  );
}
