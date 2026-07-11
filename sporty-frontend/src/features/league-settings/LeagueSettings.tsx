"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Lock, X } from "lucide-react";
import { toastifier } from "@/lib/toastifier";
import { DangerZone } from "./components/DangerZone";
import { DeleteLeagueModal } from "./components/DeleteLeagueModal";
import {
  SettingsForm,
  type LeagueSettingsData,
} from "./components/SettingsForm";
import {
  SettingsSection,
  segmentActive,
  segmentBase,
  segmentIdle,
} from "./components/SettingsSection";
import {
  useAddLeagueSport,
  useDeleteLeague,
  useGenerateTransferWindows,
  useLeague,
  useRemoveLeagueSport,
  useRenewLeague,
  useSeasonHistory,
  useSports,
  useUpdateLeague,
  useUpdateMidseasonJoin,
  useUpdateLeagueStatus,
  useStartDraft,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import {
  getLifecycleStatusesForLeague,
  getLifecycleStatusLabel,
} from "@/lib/league-lifecycle";
import { useMe } from "@/hooks/auth/useMe";

export function LeagueSettings() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leagueId = params?.id ?? "";

  const { username } = useMe();
  const { data: league } = useLeague(leagueId);
  const { data: sports } = useSports();

  const isCommissioner = league?.owner?.username === username;
  const { isBudgetMode, isDraftMode } = useLeagueCompetitionMode(league);

  const updateStatus = useUpdateLeagueStatus(leagueId);
  const renewLeague = useRenewLeague(leagueId);
  const { data: seasonHistory } = useSeasonHistory(leagueId);
  const startDraft = useStartDraft();
  const updateLeague = useUpdateLeague(leagueId);
  const updateMidseasonJoin = useUpdateMidseasonJoin(leagueId);
  const generateWindows = useGenerateTransferWindows(leagueId);
  const addSport = useAddLeagueSport(leagueId);
  const removeSport = useRemoveLeagueSport(leagueId);
  const deleteLeague = useDeleteLeague();

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [data, setData] = useState<LeagueSettingsData>(() => ({
    leagueName: league?.name ?? "",
    isPrivate: !league?.is_public,
    allowMidseasonJoin: Boolean(league?.allow_midseason_join),
    showMidseasonJoinToggle: isBudgetMode,
  }));

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

    setIsDeleting(true);
    try {
      await deleteLeague.mutateAsync(league.id);
      setShowDeleteModal(false);
      router.push("/leagues");
    } finally {
      setIsDeleting(false);
    }
  };

  // Entering DRAFTING for a draft league must go through start_draft (which
  // assigns draft positions + creates teams), NOT the raw status transition —
  // otherwise the draft is left uninitialised and no one can pick.
  const handleStartDraft = async () => {
    try {
      await startDraft.mutateAsync(leagueId);
      router.push(`/leagues/${leagueId}/create-team`);
    } catch {
      // errors are surfaced by shared mutation toast
    }
  };

  const handleStatusChange = async (
    nextStatus: "setup" | "drafting" | "active" | "completed",
  ) => {
    if (nextStatus === "drafting" && isDraftMode) {
      await handleStartDraft();
      return;
    }
    try {
      await updateStatus.mutateAsync(nextStatus);
    } catch {
      // errors are surfaced by shared mutation toast
    }
  };

  const handleRenewLeague = async () => {
    try {
      const nextLeague = await renewLeague.mutateAsync(undefined);
      router.push(`/leagues/${nextLeague.id}/settings`);
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
      <section className="space-y-6">
        <div className="card-surface p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-fg-3" aria-hidden />
          <p className="mt-2 font-sans text-sm font-700 uppercase tracking-[1px] text-fg-1">
            Commissioner only
          </p>
          <p className="mt-1 text-sm text-fg-3">
            Only the league commissioner can change these settings.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="border-b border-white/8 pb-6">
        <p className="section-label">{league?.name || "League"}</p>
        <h1 className="mt-2 font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-6xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-fg-3">
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

      {(league?.status === "completed" || (seasonHistory?.length ?? 0) > 1) && (
        <SettingsSection
          title="Season Rollover"
          description="Start the next season of this league, or review past seasons"
          action={
            league?.status === "completed" ? (
              <button
                type="button"
                onClick={handleRenewLeague}
                disabled={renewLeague.isPending}
                className={`${segmentBase} ${segmentActive} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {renewLeague.isPending ? "Starting…" : "Start Next Season"}
              </button>
            ) : null
          }
        >
          {(seasonHistory?.length ?? 0) > 0 ? (
            <div className="flex flex-col gap-2">
              {seasonHistory!.map((season) => (
                <div
                  key={season.id}
                  className={`flex items-center justify-between rounded-[3px] border px-4 py-2 text-sm ${
                    season.id === leagueId
                      ? "border-accent/40 bg-accent/5"
                      : "border-white/8"
                  }`}
                >
                  <span className="font-sans uppercase tracking-[1px] text-fg-1">
                    Season {season.season_number}
                  </span>
                  <span className="text-fg-3">
                    {getLifecycleStatusLabel(
                      season.status as
                        | "setup"
                        | "drafting"
                        | "active"
                        | "completed",
                      league,
                    )}
                  </span>
                  {season.id !== leagueId && (
                    <Link
                      href={`/leagues/${season.id}/settings`}
                      className="flex items-center gap-1 text-xs uppercase tracking-[1px] text-accent hover:underline"
                    >
                      View <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fg-3">No past seasons yet.</p>
          )}
        </SettingsSection>
      )}

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
              aria-label={`Remove ${leagueSport.sport.display_name}`}
              className={`inline-flex items-center gap-1.5 ${segmentBase} ${segmentActive}`}
            >
              {leagueSport.sport.display_name}
              <X className="h-3 w-3" aria-hidden />
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-[3px] bg-accent px-6 py-2.5 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
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
        isDeleting={isDeleting}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
