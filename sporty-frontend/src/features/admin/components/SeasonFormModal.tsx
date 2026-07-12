"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSports } from "@/hooks/leagues/useLeagues";
import { useCreateSeason, useUpdateSeason } from "@/hooks/admin/useAdminSeasons";
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
  const updateSeason = useUpdateSeason();
  const isPending = createSeason.isPending || updateSeason.isPending;

  const [sportId, setSportId] = useState(season?.sport_id ?? "");
  const [name, setName] = useState(season?.name ?? "");
  const [startDate, setStartDate] = useState(season?.start_date ?? "");
  const [endDate, setEndDate] = useState(season?.end_date ?? "");
  const [isActive, setIsActive] = useState(season?.is_active ?? true);
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (mode === "create") {
      createSeason.mutate(
        { sport_id: sportId, name, start_date: startDate, end_date: endDate, reason: reason || undefined },
        { onSuccess: onClose },
      );
    } else if (season?.id) {
      updateSeason.mutate(
        {
          id: season.id,
          data: { name, start_date: startDate, end_date: endDate, is_active: isActive, reason: reason || undefined },
        },
        { onSuccess: onClose },
      );
    }
  };

  const canSubmit = name.trim() !== "" && startDate !== "" && endDate !== "" && (mode === "edit" || sportId !== "");

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl text-fg-1">{mode === "create" ? "Create Season" : "Edit Season"}</h3>

      {mode === "create" ? (
        <Select
          label="Sport"
          value={sportId}
          onChange={setSportId}
          placeholder="Select a sport…"
          options={(sports ?? []).filter((s) => s.id).map((s) => ({ value: s.id as string, label: s.display_name }))}
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
