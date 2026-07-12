"use client";

import { ConfirmDialog } from "@/components/ui";

type RenewLeagueModalProps = {
  isOpen: boolean;
  dynasty: boolean;
  onDynastyChange: (dynasty: boolean) => void;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function RenewLeagueModal({
  isOpen,
  dynasty,
  onDynastyChange,
  isPending,
  onClose,
  onConfirm,
}: RenewLeagueModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={isPending}
      danger={false}
      title="Start Next Season"
      confirmLabel={isPending ? "Starting…" : "Start Next Season"}
      message={
        <div className="space-y-4">
          <p>
            This creates the next season of this league. Choose how squads
            carry over:
          </p>

          <label className="flex cursor-pointer items-start gap-3 rounded-[3px] border border-white/8 bg-surface-2 p-3">
            <input
              type="checkbox"
              checked={dynasty}
              onChange={(e) => onDynastyChange(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1">
                Dynasty mode
              </span>
              <span className="mt-1 block text-xs text-fg-3">
                Every team&apos;s entire roster carries over automatically —
                no re-draft. Budget-mode teams may start over budget if
                player prices moved since last season; transfers stay
                blocked until they sell down to fit, though dropping players
                is always allowed.
              </span>
            </span>
          </label>

          {!dynasty && (
            <p className="text-xs text-fg-3">
              Leaving this off starts a fresh season the normal way — a new
              draft (draft-mode leagues) or an empty squad to build from
              scratch (budget-mode leagues).
            </p>
          )}
        </div>
      }
    />
  );
}
