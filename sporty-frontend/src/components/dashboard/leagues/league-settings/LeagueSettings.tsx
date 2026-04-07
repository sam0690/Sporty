"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toastifier } from "@/libs/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { DangerZone } from "@/components/dashboard/leagues/league-settings/components/DangerZone";
import { DeleteLeagueModal } from "@/components/dashboard/leagues/league-settings/components/DeleteLeagueModal";
import { ScoringRulesEditor } from "@/components/dashboard/leagues/league-settings/components/ScoringRulesEditor";
import {
  SettingsForm,
  type LeagueSettingsData,
} from "@/components/dashboard/leagues/league-settings/components/SettingsForm";
import type { TLeague } from "@/types";
import {
  useAddLeagueSport,
  useDeleteLeague,
  useGenerateTransferWindows,
  useLeague,
  useRemoveLeagueSport,
  useSports,
  useUpdateLeagueStatus,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import {
  useDefaultScoringRules,
  useDeleteScoringOverride,
  useScoringOverrides,
  useUpsertScoringOverride,
} from "@/hooks/scoring/useScoring";
import { useMe } from "@/hooks/auth/useMe";

type LeagueSettingsShape = TLeague & {
  is_public?: boolean;
  draft_mode?: boolean;
};

export function LeagueSettings() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const leagueWithSettings = league as LeagueSettingsShape | undefined;
  const { data: sports } = useSports();

  const isCommissioner = league?.owner?.username === username;
  const { competitionType, isBudgetMode } = useLeagueCompetitionMode(league);
  const selectedSport = league?.sports?.[0]?.sport.name ?? "football";

  const { data: defaultRules } = useDefaultScoringRules(selectedSport);
  const { data: overrides } = useScoringOverrides(leagueId);
  const upsertOverride = useUpsertScoringOverride(leagueId);
  const deleteOverride = useDeleteScoringOverride(leagueId);
  const updateStatus = useUpdateLeagueStatus(leagueId);
  const generateWindows = useGenerateTransferWindows(leagueId);
  const addSport = useAddLeagueSport(leagueId);
  const removeSport = useRemoveLeagueSport(leagueId);
  const deleteLeague = useDeleteLeague();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [data, setData] = useState<LeagueSettingsData>({
    leagueName: league?.name ?? "",
    sport: "football",
    isPrivate: !leagueWithSettings?.is_public,
    teamSize: league?.squad_size ?? 10,
    draftType: competitionType === "draft" ? "snake" : "auto",
    draftDate: "",
    matchesStarted: league?.status !== "setup",
  });
  const [scoringRules, setScoringRules] = useState<Record<string, number>>({});

  const maxTeamSizeAllowed = useMemo(() => 16, []);

  useEffect(() => {
    if (!league) {
      return;
    }

    setData((prev) => ({
      ...prev,
      leagueName: league.name,
      isPrivate: !leagueWithSettings?.is_public,
      teamSize: league.squad_size,
      draftType: competitionType === "draft" ? "snake" : "auto",
      matchesStarted: league.status !== "setup",
    }));
  }, [competitionType, league, leagueWithSettings?.is_public]);

  useEffect(() => {
    if (!defaultRules) {
      return;
    }

    const overrideByAction = new Map(
      (overrides ?? []).map((override) => [
        override.action,
        Number(override.points),
      ]),
    );
    const merged = Object.fromEntries(
      defaultRules.map((rule) => [
        rule.action,
        overrideByAction.get(rule.action) ?? Number(rule.points),
      ]),
    );
    setScoringRules(merged);
  }, [defaultRules, overrides]);

  const handleSave = async () => {
    if (!isCommissioner) {
      return;
    }

    if (data.teamSize > maxTeamSizeAllowed) {
      toastifier.error("✕ Team size exceeds current league constraints");
      return;
    }

    if (!league || !sports?.length || !defaultRules?.length) {
      toastifier.error("Unable to save settings right now.");
      return;
    }

    const sportObj = sports.find((sport) => sport.name === selectedSport);
    if (!sportObj?.id) {
      toastifier.error("Selected sport is not available.");
      return;
    }

    setIsSaving(true);
    try {
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
          }
          continue;
        }

        await upsertOverride.mutateAsync({
          sport_id: sportObj.id,
          action: rule.action,
          points: nextPoints,
        });
      }

      toastifier.success("League scoring settings saved");
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
      <section className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <NavigationTabs
          activeTab="settings"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">
          Only the league commissioner can access settings.
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 space-y-6 font-[system-ui,-apple-system] text-gray-900">
      <NavigationTabs
        activeTab="settings"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <SettingsForm
        data={data}
        onChange={(next) => {
          setData((prev) => {
            const merged = { ...prev, ...next };
            if (next.sport && next.sport !== prev.sport) {
              setScoringRules({});
            }
            return merged;
          });
        }}
      />

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="text-sm font-medium text-gray-900">League Lifecycle</h3>
        <div className="flex flex-wrap gap-2">
          {(["setup", "drafting", "active", "completed"] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusChange(status)}
                className={`rounded-full border px-4 py-2 text-sm ${league?.status === status ? "border-primary-500 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-600"}`}
              >
                {status}
              </button>
            ),
          )}
        </div>

        {isBudgetMode ? (
          <button
            type="button"
            onClick={handleGenerateWindows}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Generate Transfer Windows
          </button>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
        <h3 className="text-sm font-medium text-gray-900">League Sports</h3>
        <div className="flex flex-wrap gap-2">
          {(league?.sports ?? []).map((leagueSport) => (
            <button
              key={leagueSport.sport.name}
              type="button"
              onClick={() => removeSport.mutateAsync(leagueSport.sport.name)}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
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
                className="rounded-full border border-primary-300 px-4 py-2 text-sm text-primary-700 hover:bg-primary-50"
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
          className="rounded-full bg-[#247BA0] px-6 py-2.5 font-semibold text-white hover:bg-[#1d6280] disabled:cursor-not-allowed disabled:bg-gray-300"
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
