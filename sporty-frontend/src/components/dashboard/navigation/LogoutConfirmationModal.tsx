"use client";

import { ConfirmDialog } from "@/components/ui";

type LogoutConfirmationModalProps = {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmationModal({
  isOpen,
  isLoading = false,
  onClose,
  onConfirm,
}: LogoutConfirmationModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isLoading}
      title="Do you want to log out?"
      message="You'll be signed out of your account and redirected to the login screen. Choose Cancel to stay logged in."
      confirmLabel={isLoading ? "Logging out..." : "Logout"}
    />
  );
}
