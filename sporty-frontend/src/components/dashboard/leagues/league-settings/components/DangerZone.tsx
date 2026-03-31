"use client";

type DangerZoneProps = {
  leagueName: string;
  onDeleteClick: () => void;
};

export function DangerZone({ leagueName, onDeleteClick }: DangerZoneProps) {
  return (
    <section className="rounded-2xl border border-red-100 bg-red-50/50 p-5">
      <h3 className="text-sm font-medium text-red-700">Danger Zone</h3>
      <p className="mt-1 text-sm text-red-600">
        Delete <span className="font-medium">{leagueName}</span> permanently. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={onDeleteClick}
        className="mt-4 rounded-full border border-red-300 px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        Delete League
      </button>
    </section>
  );
}
