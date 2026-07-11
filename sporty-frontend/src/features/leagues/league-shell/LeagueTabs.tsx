"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui";

type LeagueTabsProps = {
  leagueId: string;
  isDraftMode: boolean;
  isCommissioner: boolean;
};

type SubTab = { key: string; label: string; segment: string };

type TabGroup = {
  key: string;
  label: string;
  /** Segment the group link navigates to ("" = league overview). */
  segment: string;
  /** All segments that light this group up as active. */
  segments: string[];
  subTabs?: SubTab[];
};

function buildGroups(isDraftMode: boolean, isCommissioner: boolean): TabGroup[] {
  const groups: TabGroup[] = [
    { key: "overview", label: "Overview", segment: "", segments: [""] },
    { key: "team", label: "Team", segment: "lineup", segments: ["lineup"] },
    isDraftMode
      ? {
          key: "transactions",
          label: "Transactions",
          segment: "free-agents",
          segments: ["free-agents", "waivers", "trades"],
          subTabs: [
            { key: "free-agents", label: "Free Agents", segment: "free-agents" },
            { key: "waivers", label: "Waivers", segment: "waivers" },
            { key: "trades", label: "Trades", segment: "trades" },
          ],
        }
      : {
          key: "transactions",
          label: "Transfers",
          segment: "transfers",
          segments: ["transfers"],
        },
    { key: "table", label: "Table", segment: "leaderboard", segments: ["leaderboard"] },
    { key: "matchday", label: "Matchday", segment: "gameweek", segments: ["gameweek"] },
    {
      key: "league",
      label: "League",
      segment: "members",
      segments: ["members", "chat", "invite"],
      subTabs: [
        { key: "members", label: "Members", segment: "members" },
        { key: "chat", label: "Chat", segment: "chat" },
        { key: "invite", label: "Invite", segment: "invite" },
      ],
    },
  ];

  if (isCommissioner) {
    groups.push({
      key: "settings",
      label: "Settings",
      segment: "settings",
      segments: ["settings"],
    });
  }

  return groups;
}

export function LeagueTabs({
  leagueId,
  isDraftMode,
  isCommissioner,
}: LeagueTabsProps) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;

  // Current segment directly under /leagues/[id] ("" on the overview page).
  const currentSegment = pathname.startsWith(base)
    ? (pathname.slice(base.length).split("/").filter(Boolean)[0] ?? "")
    : "";

  const groups = buildGroups(isDraftMode, isCommissioner);
  const activeGroup = groups.find((g) => g.segments.includes(currentSegment));

  const hrefFor = (segment: string) => (segment ? `${base}/${segment}` : base);

  return (
    <div className="mb-6">
      <div className="overflow-x-auto card-surface p-1">
        <Tabs
          ariaLabel="League navigation"
          value={activeGroup?.key ?? ""}
          items={groups.map((group) => ({
            key: group.key,
            label: group.label,
            href: hrefFor(group.segment),
          }))}
        />
      </div>

      {activeGroup?.subTabs && (
        <div className="mt-2 overflow-x-auto px-1">
          <Tabs
            ariaLabel={`${activeGroup.label} sections`}
            size="sm"
            subtle
            value={currentSegment}
            items={activeGroup.subTabs.map((sub) => ({
              key: sub.segment,
              label: sub.label,
              href: hrefFor(sub.segment),
            }))}
          />
        </div>
      )}
    </div>
  );
}
