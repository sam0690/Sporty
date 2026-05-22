"use client";

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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-surface/95 p-6 text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <h3 className="text-lg font-medium text-foreground">Kick Member?</h3>
        <p className="mt-2 text-sm text-foreground/65">
          Remove {memberName} from this league?
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-white/10 px-4 py-2 text-foreground transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isKicking}
            className="flex-1 rounded-full border border-danger/30 bg-danger/5 px-4 py-2 font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isKicking ? "Removing..." : "Kick Member"}
          </button>
        </div>
      </div>
    </div>
  );
}
