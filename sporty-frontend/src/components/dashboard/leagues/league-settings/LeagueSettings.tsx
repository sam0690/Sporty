"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import { toastifier } from "@/lib/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { DangerZone } from "@/components/dashboard/leagues/league-settings/components/DangerZone";
import { DeleteLeagueModal } from "@/components/dashboard/leagues/league-settings/components/DeleteLeagueModal";
import { ScoringRulesEditor } from "@/components/dashboard/leagues/league-settings/components/ScoringRulesEditor";
import {
  SettingsForm,
  type LeagueSettingsData,
} from "@/components/dashboard/leagues/league-settings/components/SettingsForm";
import {
  SettingsSection,
  segmentActive,
  segmentBase,
  segmentIdle,
} from "@/components/dashboard/leagues/league-settings/components/SettingsSection";
import {
  useAddLeagueSport,
  useDeleteLeague,
  useGenerateTransferWindows,
  useLeague,
  useRemoveLeagueSport,
  useSports,
  useUpdateLeague,
  useUpdateMidseasonJoin,
  useUpdateLeagueStatus,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import {
  getLifecycleStatusesForLeague,
  getLifecycleStatusLabel,
} from "@/lib/league-lifecycle";
import {
  useDefaultScoringRules,
  useDeleteScoringOverride,
  useScoringOverrides,
  useUpsertScoringOverride,
} from "@/hooks/scoring/useScoring";
import { useMe } from "@/hooks/auth/useMe";

export function LeagueSettings() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { data: sports } = useSports();

  const isCommissioner = league?.owner?.username === username;
  const { isBudgetMode } = useLeagueCompetitionMode(league);
  const selectedSport = league?.sports?.[0]?.sport.name ?? "football";

  const { data: defaultRules } = useDefaultScoringRules(selectedSport);
  const { data: overrides } = useScoringOverrides(leagueId);
  const upsertOverride = useUpsertScoringOverride(leagueId);
  const deleteOverride = useDeleteScoringOverride(leagueId);
  const updateStatus = useUpdateLeagueStatus(leagueId);
  const updateLeague = useUpdateLeague(leagueId);
  const updateMidseasonJoin = useUpdateMidseasonJoin(leagueId);
  const generateWindows = useGenerateTransferWindows(leagueId);
  const addSport = useAddLeagueSport(leagueId);
  const removeSport = useRemoveLeagueSport(leagueId);
  const deleteLeague = useDeleteLeague();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [data, setData] = useState<LeagueSettingsData>(() => ({
    leagueName: league?.name ?? "",
    isPrivate: !league?.is_public,
    allowMidseasonJoin: Boolean(league?.allow_midseason_join),
    showMidseasonJoinToggle: isBudgetMode,
  }));
  const [scoringRules, setScoringRules] = useState<Record<string, number>>({});

  const lifecycleStatuses = useMemo(
    () => getLifecycleStatusesForLeague(league),
    [league],
  );

  // Re-sync the editable form from server data when the underlying league
  // values change (e.g. after a save invalidates + refetches). Adjusting state
  // during render on a changed sync key is React's recommended alternative to a
  // setState-in-effect; it only fires when an actual field value differs.
  const leagueSyncKey = league
    ? `${league.id}|${league.name}|${league.is_public}|${league.allow_midseason_join}|${isBudgetMode}`
    : "";
  const [lastLeagueSyncKey, setLastLeagueSyncKey] = useState(leagueSyncKey);
  if (league && leagueSyncKey !== lastLeagueSyncKey) {
    setLastLeagueSyncKey(leagueSyncKey);
    setData({
      leagueName: league.name,
      isPrivate: !league.is_public,
      allowMidseasonJoin: Boolean(league.allow_midseason_join),
      showMidseasonJoinToggle: isBudgetMode,
    });
  }

  // Merge default scoring rules with any league overrides into the editable
  // map, re-syncing when either source changes. Same render-time pattern.
  const scoringSyncKey = useMemo(() => {
    if (!defaultRules) {
      return null;
    }
    const defaultPart = defaultRules
      .map((rule) => `${rule.action}=${rule.points}`)
      .join(",");
    const overridePart = (overrides ?? [])
      .map((override) => `${override.action}=${override.points}`)
      .sort()
      .join(",");
    return `${defaultPart}::${overridePart}`;
  }, [defaultRules, overrides]);
  const [lastScoringSyncKey, setLastScoringSyncKey] = useState<string | null>(
    null,
  );
  if (defaultRules && scoringSyncKey !== lastScoringSyncKey) {
    setLastScoringSyncKey(scoringSyncKey);
    const overrideByAction = new Map(
      (overrides ?? []).map((override) => [
        override.action,
        Number(override.points),
      ]),
    );
    setScoringRules(
      Object.fromEntries(
        defaultRules.map((rule) => [
          rule.action,
          overrideByAction.get(rule.action) ?? Number(rule.points),
        ]),
      ),
    );
  }

  const handleSave = async () => {
    if (!isCommissioner || !league) {
      return;
    }

    const trimmedName = data.leagueName.trim();
    if (!trimmedName) {
      toastifier.error("League name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      let changed = false;

      // 1. League name + public/private visibility — only send what changed.
      const leaguePatch: { name?: string; is_public?: boolean } = {};
      if (trimmedName !== league.name) {
        leaguePatch.name = trimmedName;
      }
      const nextIsPublic = !data.isPrivate;
      if (nextIsPublic !== Boolean(league.is_public)) {
        leaguePatch.is_public = nextIsPublic;
      }
      if (Object.keys(leaguePatch).length > 0) {
        await updateLeague.mutateAsync(leaguePatch);
        changed = true;
      }

      // 2. Mid-season joining (budget leagues only).
      if (
        isBudgetMode &&
        data.allowMidseasonJoin !== Boolean(league.allow_midseason_join)
      ) {
        await updateMidseasonJoin.mutateAsync(data.allowMidseasonJoin);
        changed = true;
      }

      // 3. Scoring rule overrides — diff each rule against its default.
      const sportObj = sports?.find((sport) => sport.name === selectedSport);
      if (defaultRules?.length && sportObj?.id) {
        for (const rule of defaultRules) {
          const nextPoints = Number(scoringRules[rule.action]);
          if (Number.isNaN(nextPoints)) {
            continue;
          }

          if (Number(nextPoints) === Number(rule.points)) {
            const existingOverride = (overrides ?? []).find(
              (override) => override.action === rule.action,
            );
            if (existingOverride) {
              await deleteOverride.mutateAsync(existingOverride.id);
              changed = true;
            }
            continue;
          }

          await upsertOverride.mutateAsync({
            sport_id: sportObj.id,
            action: rule.action,
            points: nextPoints,
          });
          changed = true;
        }
      }

      if (!changed) {
        toastifier.info("No changes to save.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!league) {
      return;
    }

    if (deleteConfirmText.trim() !== league.name) {
      toastifier.error("Type the exact league name to confirm deletion.");
      return;
    }

    setIsDeleting(true);
    try {
      await deleteLeague.mutateAsync(league.id);
      setShowDeleteModal(false);
      setDeleteConfirmText("");
      router.push("/leagues");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleStatusChange = async (
    nextStatus: "setup" | "drafting" | "active" | "completed",
  ) => {
    try {
      await updateStatus.mutateAsync(nextStatus);
    } catch {
      // errors are surfaced by shared mutation toast
    }
  };

  const handleGenerateWindows = async () => {
    try {
      await generateWindows.mutateAsync(undefined);
    } catch {
      // errors are surfaced by shared mutation toast
    }
  };

  if (!isCommissioner) {
    return (
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#0B1220]">
        <NavigationTabs
          activeTab="settings"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <div className="surface flex flex-col items-center p-8 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-md bg-surface-muted text-ink-muted"
            aria-hidden
          >
            <Lock className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <p className="mt-3 font-condensed text-sm font-bold uppercase tracking-[0.06em] text-ink">
            Commissioner only
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            Only the league commissioner can change these settings.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#0B1220]">
      <NavigationTabs
        activeTab="settings"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <header className="border-b border-[rgba(11,18,32,0.08)] pb-6">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-bebas text-5xl tracking-[3px] text-[#0B1220] sm:text-6xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Manage your league&apos;s configuration and scoring
        </p>
      </header>

      <SettingsForm
        data={data}
        onChange={(next) => setData((prev) => ({ ...prev, ...next }))}
      />

      <SettingsSection
        title="League Lifecycle"
        description="Move the league between setup, drafting, active and completed"
        action={
          isBudgetMode ? (
            <button
              type="button"
              onClick={handleGenerateWindows}
              className={`${segmentBase} ${segmentIdle}`}
            >
              Generate Windows
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap gap-2">
          {lifecycleStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              className={`${segmentBase} ${league?.status === status ? segmentActive : segmentIdle}`}
            >
              {getLifecycleStatusLabel(status, league)}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="League Sports"
        description="Add or remove the sports played in this league"
      >
        <div className="flex flex-wrap gap-2">
          {(league?.sports ?? []).map((leagueSport) => (
            <button
              key={leagueSport.sport.name}
              type="button"
              onClick={() => removeSport.mutateAsync(leagueSport.sport.name)}
              className={`${segmentBase} ${segmentActive} inline-flex items-center gap-1.5`}
            >
              {leagueSport.sport.display_name}
              <X className="h-3 w-3" />
            </button>
          ))}
          {(sports ?? [])
            .filter(
              (sport) =>
                !(league?.sports ?? []).some(
                  (leagueSport) => leagueSport.sport.name === sport.name,
                ),
            )
            .map((sport) => (
              <button
                key={sport.name}
                type="button"
                onClick={() => addSport.mutateAsync(sport.name)}
                className={`${segmentBase} ${segmentIdle}`}
              >
                + {sport.display_name}
              </button>
            ))}
        </div>
      </SettingsSection>

      <ScoringRulesEditor
        scoringRules={scoringRules}
        onChange={setScoringRules}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-[3px] bg-[#DC2626] px-6 py-2.5 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <DangerZone
        leagueName={data.leagueName}
        onDeleteClick={() => setShowDeleteModal(true)}
      />

      <DeleteLeagueModal
        isOpen={showDeleteModal}
        leagueName={data.leagueName}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        isDeleting={isDeleting}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText("");
        }}
        onConfirm={handleDelete}
      />
    </section>
  );
}
