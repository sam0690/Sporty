"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
        <NavigationTabs
          activeTab="settings"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-6 text-sm text-[#555560] ">
          Only the league commissioner can access settings.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 text-[#f0f0f0]">
      <NavigationTabs
        activeTab="settings"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <SettingsForm
        data={data}
        onChange={(next) => setData((prev) => ({ ...prev, ...next }))}
      />

      <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
        <h3 className="text-sm text-[#f0f0f0]">
          League Lifecycle
        </h3>
        <div className="flex flex-wrap gap-2">
          {lifecycleStatuses.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status)}
              className={`rounded-[3px] border px-4 py-2 text-sm ${league?.status === status ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560]"}`}
            >
              {getLifecycleStatusLabel(status, league)}
            </button>
          ))}
        </div>

        {isBudgetMode ? (
          <button
            type="button"
            onClick={handleGenerateWindows}
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] hover:bg-[#1d1d26]"
          >
            Generate Transfer Windows
          </button>
        ) : null}
      </section>

      <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
        <h3 className="text-sm text-[#f0f0f0]">League Sports</h3>
        <div className="flex flex-wrap gap-2">
          {(league?.sports ?? []).map((leagueSport) => (
            <button
              key={leagueSport.sport.name}
              type="button"
              onClick={() => removeSport.mutateAsync(leagueSport.sport.name)}
              className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] hover:bg-[#1d1d26]"
            >
              {leagueSport.sport.display_name} x
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
                className="rounded-[3px] border border-[rgba(232,251,37,0.2)] px-4 py-2 text-sm text-[#e8fb25] hover:bg-[rgba(232,251,37,0.1)]"
              >
                + {sport.display_name}
              </button>
            ))}
        </div>
      </section>

      <ScoringRulesEditor
        scoringRules={scoringRules}
        onChange={setScoringRules}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-[3px] bg-linear-to-r [#e8fb25] px-6 py-2.5 font-600 text-slate-950 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Changes"}
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
