"use client";

import { ConfirmDialog } from "@/components/ui";

type DeleteLeagueModalProps = {
  isOpen: boolean;
  leagueName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteLeagueModal({
  isOpen,
  leagueName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteLeagueModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isDeleting}
      title="Delete League"
      message={
        <>
          Type <span className="font-600 text-fg-1">{leagueName}</span> to
          confirm permanent deletion.
        </>
      }
      confirmLabel={isDeleting ? "Deleting..." : "Delete League"}
      confirmInput={{ expectedValue: leagueName, placeholder: "League name" }}
    />
  );
}
