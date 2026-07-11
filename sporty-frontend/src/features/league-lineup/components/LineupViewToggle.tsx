"use client";

import { Tabs } from "@/components/ui";

type LineupViewToggleProps = {
  value: "list" | "pitch";
  onChange: (mode: "list" | "pitch") => void;
};

export function LineupViewToggle({ value, onChange }: LineupViewToggleProps) {
  return (
    <Tabs
      ariaLabel="Lineup view"
      value={value}
      onChange={(key) => onChange(key as "list" | "pitch")}
      items={[
        { key: "list", label: "List View" },
        { key: "pitch", label: "Pitch View" },
      ]}
    />
  );
}
