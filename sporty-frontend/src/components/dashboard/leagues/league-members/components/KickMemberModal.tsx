"use client";

import { Modal } from "@/components/ui";

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
    <Modal isOpen={isOpen} onClose={onClose} closeDisabled={isKicking}>
      <h3 className="font-barlow-condensed text-xl font-700 uppercase tracking-[2px] text-[#f0f0f0]">
        Kick Member?
      </h3>
      <p className="mt-2 text-sm text-[#555560]">
        Remove {memberName} from this league? Their team will be permanently
        removed.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560] transition-colors hover:text-[#f0f0f0]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isKicking}
          className="flex-1 rounded-[3px] bg-[#ff3b30] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-white transition-colors hover:bg-[#ff5548] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isKicking ? "Removing..." : "Kick Member"}
        </button>
      </div>
    </Modal>
  );
}
