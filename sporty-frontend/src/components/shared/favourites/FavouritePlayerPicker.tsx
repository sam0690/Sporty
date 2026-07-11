"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Search, User as UserIcon, X } from "lucide-react";
import { Loader, Popover, ScrollArea, TextInput } from "@mantine/core";
import { PlayerAvatar, TeamLogo } from "@/components/ui";
import { PlayerService } from "@/services/PlayerService";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import type { TFavouritePlayer } from "@/services/UserService";

type SportName = "football" | "basketball";

type FavouritePlayerPickerProps = {
  sport: SportName;
  value: TFavouritePlayer | null;
  onChange: (player: TFavouritePlayer) => void;
  onClear?: () => void;
};

export function FavouritePlayerPicker({
  sport,
  value,
  onChange,
  onClear,
}: FavouritePlayerPickerProps) {
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isFetching } = useApiQuery(
    ["favourite-player-picker", sport, debouncedSearch],
    () =>
      PlayerService.getPlayers({
        sport_name: sport,
        search: debouncedSearch || undefined,
        page_size: 20,
      }),
    { enabled: opened },
  );
  const players = data?.items ?? [];

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={340}
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
              <PlayerAvatar name={value.name} photoUrl={value.photo_url} size="sm" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-3">
                <UserIcon size={16} aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-1">
                {value ? value.name : `Choose your favourite ${sport} player`}
              </span>
              {value ? (
                <span className="block truncate text-xs text-fg-3">
                  {value.position} · {value.real_team}
                </span>
              ) : null}
            </span>
            <ChevronDown size={16} className="shrink-0 text-fg-3" aria-hidden />
          </button>
          {value && onClear ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear favourite player"
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
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          placeholder="Search players by name..."
          leftSection={<Search size={14} aria-hidden />}
          autoFocus
          styles={{
            input: {
              background: "#0d0d12",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f2f2f0",
              fontSize: "14px",
            },
          }}
        />

        <div className="mt-3">
          {isLoading || isFetching ? (
            <div className="flex justify-center py-6">
              <Loader size="sm" color="#e2c368" />
            </div>
          ) : players.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-3">
              No players found.
            </p>
          ) : (
            <ScrollArea.Autosize mah={280}>
              <ul role="listbox" className="space-y-1">
                {players.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value?.id === player.id}
                      onClick={() => {
                        onChange({
                          id: player.id,
                          name: player.name ?? player.display_name,
                          position: player.position,
                          real_team: player.real_team,
                          photo_url: player.photo_url ?? null,
                          real_team_logo_url: player.real_team_logo_url ?? null,
                          cost: player.cost ?? player.current_cost,
                          sport: player.sport,
                        });
                        setOpened(false);
                      }}
                      className={`flex min-h-[44px] w-full items-center gap-3 rounded-[3px] px-3 py-2 text-left text-sm transition-colors ${
                        value?.id === player.id
                          ? "bg-accent/10 text-accent"
                          : "text-fg-1 hover:bg-surface-3"
                      }`}
                    >
                      <PlayerAvatar
                        name={player.name ?? ""}
                        photoUrl={player.photo_url}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {player.name}
                        <span className="ml-1.5 text-xs text-fg-3">
                          {player.position} · {player.real_team}
                        </span>
                      </span>
                      {player.real_team ? (
                        <TeamLogo
                          teamName={player.real_team}
                          logoUrl={player.real_team_logo_url}
                          size="sm"
                        />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea.Autosize>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
