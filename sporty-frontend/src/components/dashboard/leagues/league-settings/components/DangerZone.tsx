"use client";

type DangerZoneProps = {
  leagueName: string;
  onDeleteClick: () => void;
};

export function DangerZone({ leagueName, onDeleteClick }: DangerZoneProps) {
  return (
    <section className="rounded-lg border border-red-100 bg-danger/5/50 p-5">
      <h3 className="text-sm font-medium text-danger">Danger Zone</h3>
      <p className="mt-1 text-sm text-danger">
        Delete <span className="font-medium">{leagueName}</span> permanently. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={onDeleteClick}
        className="mt-4 rounded-full border border-danger/30 px-5 py-2 text-sm font-medium text-danger hover:bg-danger/10"
      >
        Delete League
      </button>
    </section>
  );
}
