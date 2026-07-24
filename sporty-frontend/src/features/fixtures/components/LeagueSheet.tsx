"use client";

import { Drawer } from "@mantine/core";

import type { LeagueEntry } from "../fixtureFormat";
import { LeagueList } from "./LeagueList";

type LeagueSheetProps = {
  opened: boolean;
  onClose: () => void;
  entries: LeagueEntry[];
  active: string | null;
  onSelect: (competition: string | null) => void;
  onToggleFollow: (competition: string) => void;
};

// Mobile competition filter: a bottom sheet wrapping the same LeagueList as the
// desktop rail. Selecting a competition closes the sheet.
export function LeagueSheet({
  opened,
  onClose,
  entries,
  active,
  onSelect,
  onToggleFollow,
}: LeagueSheetProps) {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="80%"
      withCloseButton
      title="Competitions"
      styles={{
        content: { background: "#0d0d12" },
        header: { background: "#0d0d12", borderBottom: "1px solid rgba(255,255,255,0.08)" },
        title: {
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.5px",
          fontSize: "13px",
          color: "#e8e8ea",
        },
      }}
    >
      <div className="pt-2">
        <LeagueList
          entries={entries}
          active={active}
          onSelect={(c) => {
            onSelect(c);
            onClose();
          }}
          onToggleFollow={onToggleFollow}
        />
      </div>
    </Drawer>
  );
}
