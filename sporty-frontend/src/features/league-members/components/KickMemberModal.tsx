"use client";

import { ConfirmDialog } from "@/components/ui";

type KickMemberModalProps = {
  isOpen: boolean;
  memberName: string;
  isKicking: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function KickMemberModal({
  isOpen,
  memberName,
  isKicking,
  onClose,
  onConfirm,
}: KickMemberModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isKicking}
      title="Kick Member?"
      message={`Remove ${memberName} from this league? Their team will be permanently removed.`}
      confirmLabel={isKicking ? "Removing..." : "Kick Member"}
    />
  );
}
