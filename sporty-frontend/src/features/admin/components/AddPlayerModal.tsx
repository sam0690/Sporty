"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSports } from "@/hooks/leagues/useLeagues";
import { useRealTeams } from "@/hooks/players/usePlayers";
import { useCreatePlayer } from "@/hooks/admin/useAdminPlayers";
import { POSITION_MAP, POSITION_LABELS, type PlayerFilterSport } from "@/lib/playerPositions";

type AddPlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AddPlayerModal({ isOpen, onClose }: AddPlayerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Player">
      {isOpen && <AddPlayerForm onClose={onClose} />}
    </Modal>
  );
}

function AddPlayerForm({ onClose }: { onClose: () => void }) {
  const { data: sports } = useSports();
  const { data: teams } = useRealTeams();
  const createPlayer = useCreatePlayer();

  const [sportId, setSportId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [cost, setCost] = useState("4.0");
  const [externalApiId, setExternalApiId] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [reason, setReason] = useState("");

  const sportOptions = (sports ?? []).filter((s) => s.id);
  const sportName = sportOptions.find((s) => s.id === sportId)?.name;

  // Clubs are listed for every sport at once, so the team list has to be
  // narrowed by the chosen sport — the backend rejects a cross-sport pair
  // anyway, and offering it would just be a 409 waiting to happen.
  const teamOptions = (teams ?? []).filter((t) => !sportName || t.sport?.name === sportName);

  // "All" is a filter value, not a position — drop it.
  const positionOptions = (POSITION_MAP[sportName as Exclude<PlayerFilterSport, "All">] ?? [])
    .filter((code) => code !== "All")
    .map((code) => ({ value: code, label: `${code} — ${POSITION_LABELS[code] ?? code}` }));

  const pickSport = (id: string) => {
    setSportId(id);
    setTeamId("");
    setPosition("");
  };

  const costValue = Number(cost);
  const canSubmit =
    sportId !== "" &&
    teamId !== "" &&
    name.trim() !== "" &&
    position !== "" &&
    Number.isFinite(costValue) &&
    costValue > 0;

  const handleSubmit = () => {
    createPlayer.mutate(
      {
        sport_id: sportId,
        real_team_id: teamId,
        name: name.trim(),
        position,
        cost: costValue,
        is_available: isAvailable,
        external_api_id: externalApiId.trim() || undefined,
        photo_url: photoUrl.trim() || undefined,
        reason: reason.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-3">
        For players the provider&apos;s squad feed misses. They score zero for any match already
        booked, so re-book the match after adding them.
      </p>

      <Select
        label="Sport"
        value={sportId}
        onChange={pickSport}
        placeholder="Select a sport…"
        options={sportOptions.map((s) => ({ value: s.id as string, label: s.display_name }))}
      />

      <Select
        label="Club"
        value={teamId}
        onChange={setTeamId}
        placeholder={sportId ? "Select a club…" : "Pick a sport first"}
        options={teamOptions.map((t) => ({ value: t.id, label: t.name }))}
      />

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jorge Domínguez" maxLength={150} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Position"
          value={position}
          onChange={setPosition}
          placeholder={sportId ? "Select…" : "Pick a sport first"}
          options={positionOptions}
        />
        <label className="block">
          <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Cost (£m)</span>
          <Input type="number" step="0.1" min="0.1" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
      </div>

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          Provider Player ID (optional)
        </span>
        <Input
          value={externalApiId}
          onChange={(e) => setExternalApiId(e.target.value)}
          placeholder="e.g. 656189"
          maxLength={100}
        />
        <p className="mt-1 text-xs text-fg-3">
          The API-Football player id. Set it and future match sheets resolve this player by id
          instead of by name — which is what stops them scoring zero again.
        </p>
      </label>

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">
          Photo URL (optional)
        </span>
        <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" maxLength={500} />
      </label>

      <label className="flex items-center gap-2 text-sm text-fg-1">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        Available for selection
      </label>

      <label className="block">
        <span className="mb-2 block font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-2">Reason (optional)</span>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit log note…" maxLength={1000} />
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" disabled={createPlayer.isPending} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={createPlayer.isPending || !canSubmit} onClick={handleSubmit}>
          Add Player
        </Button>
      </div>
    </div>
  );
}
