"use client";

import { useState } from "react";
import { ChevronDown, Shield, X } from "lucide-react";
import { Loader, Popover, ScrollArea } from "@mantine/core";
import { TeamLogo } from "@/components/ui";
import { PlayerService, type TTeamBrief } from "@/services/PlayerService";
import { useApiQuery } from "@/hooks/api/useApiQuery";

type SportName = "football" | "basketball";

type FavouriteTeamPickerProps = {
  sport: SportName;
  value: TTeamBrief | null;
  onChange: (team: TTeamBrief) => void;
  onClear?: () => void;
};

export function FavouriteTeamPicker({
  sport,
  value,
  onChange,
  onClear,
}: FavouriteTeamPickerProps) {
  const [opened, setOpened] = useState(false);

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
        <div className="flex w-full min-h-[56px] items-center gap-2 card-surface pr-2 transition-colors hover:border-white/15">
          <button
            type="button"
            onClick={() => setOpened((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={opened}
            className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {value ? (
              <TeamLogo teamName={value.name} logoUrl={value.logo_url} size="md" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-3">
                <Shield size={16} aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-1">
                {value ? value.name : `Choose your favourite ${sport} team`}
              </span>
            </span>
            <ChevronDown size={16} className="shrink-0 text-fg-3" aria-hidden />
          </button>
          {value && onClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear favourite team"
              className="grid size-8 shrink-0 place-items-center rounded-full text-fg-3 transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <X size={15} aria-hidden />
            </button>
          ) : null}
        </div>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: "#111117",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "12px",
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader size="sm" color="#e2c368" />
          </div>
        ) : !teams || teams.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-3">
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
                        ? "bg-accent/10 text-accent"
                        : "text-fg-1 hover:bg-surface-3"
                    }`}
                  >
                    <TeamLogo teamName={team.name} logoUrl={team.logo_url} size="md" />
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
