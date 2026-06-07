"use client";

type DangerZoneProps = {
  leagueName: string;
  onDeleteClick: () => void;
};

export function DangerZone({ leagueName, onDeleteClick }: DangerZoneProps) {
  return (
    <section className="rounded-[3px] border border-red-400/20 bg-red-500/10 p-5 ">
      <h3 className="text-sm text-red-100">Danger Zone</h3>
      <p className="mt-1 text-sm text-red-100/75">
        Delete <span className="font-medium">{leagueName}</span> permanently.
        This cannot be undone.
      </p>
      <button
        type="button"
        onClick={onDeleteClick}
        className="mt-4 rounded-[3px] border border-red-400/20 px-5 py-2 text-sm text-red-100 hover:bg-red-500/15"
      >
        Delete League
      </button>
    </section>
  );
}
