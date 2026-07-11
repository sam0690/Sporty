"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Blocks backdrop-click/Escape-to-close while true (e.g. a mutation is in flight). */
  closeDisabled?: boolean;
  maxWidthClassName?: string;
  title?: string;
};

/**
 * Shared modal chrome, built on native <dialog> so focus trapping, Escape-to-close,
 * and top-layer stacking come from the platform instead of hand-rolled JS.
 */
export function Modal({
  isOpen,
  onClose,
  children,
  closeDisabled = false,
  maxWidthClassName = "max-w-md",
  title,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!isOpen && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Escape fires 'cancel' before 'close' — intercept so closeDisabled can
  // block it, and so both paths funnel through the same onClose.
  const handleCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (!closeDisabled) {
      onClose();
    }
  };

  const handleClose = () => {
    if (!closeDisabled) {
      onClose();
    }
  };

  // Clicking the ::backdrop registers as a click on the <dialog> element
  // itself (not its children), so this only fires for true backdrop clicks.
  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget && !closeDisabled) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClose={handleClose}
      onClick={handleBackdropClick}
      aria-labelledby={title ? titleId : undefined}
      className={`w-full ${maxWidthClassName} card-surface m-auto max-h-[85vh] overflow-y-auto p-6 backdrop:bg-black/70`}
    >
      {title && (
        <h3 id={titleId} className="sr-only">
          {title}
        </h3>
      )}
      {children}
    </dialog>
  );
}
