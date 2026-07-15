"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useGenerateSeasonWindows } from "@/hooks/admin/useAdminSeasons";
import type { TAdminSeason } from "@/services/AdminService";

const WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

type GenerateWindowsModalProps = {
  isOpen: boolean;
  season?: TAdminSeason;
  onClose: () => void;
};

export function GenerateWindowsModal({ isOpen, season, onClose }: GenerateWindowsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Transfer Windows">
      {isOpen && season && <GenerateWindowsBody season={season} onClose={onClose} />}
    </Modal>
  );
}

function GenerateWindowsBody({
  season,
  onClose,
}: {
  season: TAdminSeason;
  onClose: () => void;
}) {
  const generateWindows = useGenerateSeasonWindows();
  const [transferDay, setTransferDay] = useState("1");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    generateWindows.mutate(
      { id: season.id ?? "", data: { transfer_day: Number(transferDay), reason: reason || undefined } },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="font-display text-xl text-fg-1">Generate Transfer Windows</h3>
      <p className="text-sm text-fg-3">
        Creates one transfer window per week for <span className="text-fg-1">{season.name}</span>, shared by
        every league on this season. This can only be done once per season — pick the weekday carefully.
      </p>

      <Select
        label="Transfer Weekday"
        value={transferDay}
        onChange={setTransferDay}
        options={WEEKDAY_OPTIONS}
      />

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          Reason (optional)
        </span>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit log note…" />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" disabled={generateWindows.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={generateWindows.isPending} onClick={handleSubmit}>
          Generate
        </Button>
      </div>
    </div>
  );
}
