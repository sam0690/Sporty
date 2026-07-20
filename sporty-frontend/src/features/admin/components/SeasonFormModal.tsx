"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSports } from "@/hooks/leagues/useLeagues";
import {
  useCreateSeason,
  useCreateUnifiedSeason,
  useUpdateSeason,
} from "@/hooks/admin/useAdminSeasons";
import type { TAdminSeason } from "@/services/AdminService";

type SeasonFormModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  season?: TAdminSeason;
  onClose: () => void;
};

export function SeasonFormModal({ isOpen, mode, season, onClose }: SeasonFormModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === "create" ? "Create Season" : "Edit Season"}>
      {isOpen && <SeasonFormBody mode={mode} season={season} onClose={onClose} />}
    </Modal>
  );
}

function SeasonFormBody({
  mode,
  season,
  onClose,
}: {
  mode: "create" | "edit";
  season?: TAdminSeason;
  onClose: () => void;
}) {
  const { data: sports } = useSports();
  const createSeason = useCreateSeason();
  const createUnifiedSeason = useCreateUnifiedSeason();
  const updateSeason = useUpdateSeason();
  const isPending = createSeason.isPending || createUnifiedSeason.isPending || updateSeason.isPending;

  const [sportId, setSportId] = useState(season?.sport_id ?? "");
  const [name, setName] = useState(season?.name ?? "");
  const [label, setLabel] = useState(season?.label ?? "");
  const [startDate, setStartDate] = useState(season?.start_date ?? "");
  const [endDate, setEndDate] = useState(season?.end_date ?? "");
  const [isActive, setIsActive] = useState(season?.is_active ?? true);
  const [reason, setReason] = useState("");
  // Unified multisport season: dates are derived server-side from the overlap
  // of the selected sports' current seasons, so no sport/date inputs here.
  const [isUnified, setIsUnified] = useState(false);
  const [componentSportIds, setComponentSportIds] = useState<string[]>([]);

  const toggleComponentSport = (id: string) =>
    setComponentSportIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSubmit = () => {
    if (mode === "create" && isUnified) {
      createUnifiedSeason.mutate(
        {
          component_sport_ids: componentSportIds,
          name,
          label: label || undefined,
          reason: reason || undefined,
        },
        { onSuccess: onClose },
      );
    } else if (mode === "create") {
      createSeason.mutate(
        {
          sport_id: sportId, name, start_date: startDate, end_date: endDate,
          label: label || undefined, reason: reason || undefined,
        },
        { onSuccess: onClose },
      );
    } else if (season?.id) {
      updateSeason.mutate(
        {
          id: season.id,
          data: {
            name, start_date: startDate, end_date: endDate, is_active: isActive,
            label: label || undefined, reason: reason || undefined,
          },
        },
        { onSuccess: onClose },
      );
    }
  };

  const canSubmit =
    name.trim() !== "" &&
    (mode === "create" && isUnified
      ? componentSportIds.length >= 2
      : startDate !== "" && endDate !== "" && (mode === "edit" || sportId !== ""));

  const sportOptions = (sports ?? []).filter((s) => s.id);

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl text-fg-1">{mode === "create" ? "Create Season" : "Edit Season"}</h3>

      {mode === "create" && (
        <label className="flex items-center gap-2 text-sm text-fg-1">
          <input
            type="checkbox"
            checked={isUnified}
            onChange={(e) => setIsUnified(e.target.checked)}
          />
          Multisport (unified) season
        </label>
      )}

      {mode === "create" && isUnified ? (
        <div>
          <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
            Sports (pick 2 or more)
          </span>
          <div className="space-y-1.5">
            {sportOptions.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-fg-1">
                <input
                  type="checkbox"
                  checked={componentSportIds.includes(s.id as string)}
                  onChange={() => toggleComponentSport(s.id as string)}
                />
                {s.display_name}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-fg-3">
            Dates are derived automatically as the overlap of the selected sports&apos; current
            seasons (later start → earlier end). Every selected sport must be in-season now.
          </p>
        </div>
      ) : mode === "create" ? (
        <Select
          label="Sport"
          value={sportId}
          onChange={setSportId}
          placeholder="Select a sport…"
          options={sportOptions.map((s) => ({ value: s.id as string, label: s.display_name }))}
        />
      ) : (
        <div>
          <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Sport</span>
          <p className="text-sm text-fg-3">{sports?.find((s) => s.id === season?.sport_id)?.display_name ?? season?.sport_id}</p>
        </div>
      )}

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026/27 Season" />
      </label>

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          Cross-Sport Label (optional)
        </span>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. 2026/27"
          maxLength={20}
        />
        <p className="mt-1 text-xs text-fg-3">
          Display only — helps admins spot which seasons across sports belong to the same cycle. Does not
          affect scoring; that mapping is set per league.
        </p>
      </label>

      {!(mode === "create" && isUnified) && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Start Date</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">End Date</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
      )}

      {mode === "edit" && (
        <label className="flex items-center gap-2 text-sm text-fg-1">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>
      )}

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Reason (optional)</span>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit log note…" />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" disabled={isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={isPending || !canSubmit} onClick={handleSubmit}>
          {mode === "create" ? "Create" : "Save"}
        </Button>
      </div>
    </div>
  );
}
