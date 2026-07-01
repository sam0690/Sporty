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
      <div className="w-full max-w-md rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-6 text-[#0B1220] ">
        <h3 className="text-lg text-[#0B1220]">Kick Member?</h3>
        <p className="mt-2 text-sm text-[#0B1220]/65">
          Remove {memberName} from this league?
        </p>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-2 text-[#0B1220] transition-colors hover:bg-[#F3F4F7]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isKicking}
            className="flex-1 rounded-[3px] border border-danger/30 bg-danger/5 px-4 py-2 text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isKicking ? "Removing..." : "Kick Member"}
          </button>
        </div>
      </div>
    </div>
  );
}
