"use client";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  const isDanger = variant === "danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`w-full max-w-md rounded-[3px] border p-6 text-[#f0f0f0] ${
          isDanger ? "border-[rgba(255,59,48,0.25)]" : "border-[rgba(232,251,37,0.25)]"
        } bg-[#111117]`}
      >
        <h3
          className={`font-barlow-condensed text-xl font-700 uppercase tracking-[2px] ${
            isDanger ? "text-[#ff3b30]" : "text-[#e8fb25]"
          }`}
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-[#9a9aa5]">{message}</p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className={`flex-1 rounded-[3px] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              isDanger
                ? "bg-[#ff3b30] text-white hover:bg-[#ff5548]"
                : "bg-[#e8fb25] text-[#0a0a0f] hover:bg-[#f0ff45]"
            }`}
          >
            {isPending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
