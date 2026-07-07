"use client";

import { useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import { Loader, Popover, ScrollArea } from "@mantine/core";
import { PlayerService, type TTeamBrief } from "@/services/PlayerService";
import { useApiQuery } from "@/hooks/api/useApiQuery";

type SportName = "football" | "basketball";

type FavouriteTeamPickerProps = {
  value: TTeamBrief | null;
  onChange: (team: TTeamBrief) => void;
};

const segmentBase =
  "rounded-[3px] border px-3 py-1.5 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1.5px] transition-colors";
const segmentActive =
  "border-[rgba(232,251,37,0.4)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]";
const segmentIdle =
  "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#9a9aa5] hover:text-[#f0f0f0]";

export function FavouriteTeamPicker({ value, onChange }: FavouriteTeamPickerProps) {
  const [opened, setOpened] = useState(false);
  const [sport, setSport] = useState<SportName>(
    (value?.sport.name as SportName) ?? "football",
  );

  const { data: teams, isLoading } = useApiQuery(
    ["favourite-team-picker", sport],
    () => PlayerService.getTeams(sport),
    { enabled: opened },
  );

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={320}
      position="bottom-start"
      shadow="xl"
      withinPortal
    >
      <Popover.Target>
        <button
          type="button"
          onClick={() => setOpened((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={opened}
          className="flex w-full min-h-[56px] items-center gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] px-4 py-2.5 text-left transition-colors hover:border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,251,37,0.4)]"
        >
          {value ? (
            <img
              src={value.logo_url ?? ""}
              alt={`${value.name} crest`}
              className="h-8 w-8 shrink-0 rounded-full object-contain bg-[#1d1d26]"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d26] text-[#555560]">
              <Shield size={16} aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-[#f0f0f0]">
              {value ? value.name : "Choose your favourite team"}
            </span>
            {value ? (
              <span className="block text-xs text-[#555560]">
                {value.sport.display_name}
              </span>
            ) : null}
          </span>
          <ChevronDown size={16} className="shrink-0 text-[#555560]" aria-hidden />
        </button>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: "#111117",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "3px",
          padding: "12px",
        }}
      >
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setSport("football")}
            className={`${segmentBase} ${sport === "football" ? segmentActive : segmentIdle}`}
          >
            Football
          </button>
          <button
            type="button"
            onClick={() => setSport("basketball")}
            className={`${segmentBase} ${sport === "basketball" ? segmentActive : segmentIdle}`}
          >
            Basketball
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader size="sm" color="#e8fb25" />
          </div>
        ) : !teams || teams.length === 0 ? (
          <p className="py-6 text-center text-sm text-[#555560]">
            No teams found for this sport.
          </p>
        ) : (
          <ScrollArea.Autosize mah={280}>
            <ul role="listbox" className="space-y-1">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value?.id === team.id}
                    onClick={() => {
                      onChange(team);
                      setOpened(false);
                    }}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-[3px] px-3 py-2 text-left text-sm transition-colors ${
                      value?.id === team.id
                        ? "bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
                        : "text-[#f0f0f0] hover:bg-[#1d1d26]"
                    }`}
                  >
                    <img
                      src={team.logo_url ?? ""}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full object-contain bg-[#1d1d26]"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <span className="truncate">{team.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
