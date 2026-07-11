"use client";

import type { MouseEvent, ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Blocks backdrop-click-to-close while true (e.g. a mutation is in flight). */
  closeDisabled?: boolean;
  maxWidthClassName?: string;
};

/**
 * Shared modal chrome (backdrop + panel) — every league page used to hand-roll
 * this exact shell. Callers own their own body content; this only standardises
 * the overlay, dismiss-on-backdrop-click, and panel styling.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  closeDisabled = false,
  maxWidthClassName = "max-w-md",
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !closeDisabled) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className={`w-full ${maxWidthClassName} card-surface p-6`}
      >
        {children}
      </div>
    </div>
  );
}
