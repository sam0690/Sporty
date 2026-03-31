"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toastifier } from "@/libs/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { DangerZone } from "@/components/dashboard/leagues/league-settings/components/DangerZone";
import { DeleteLeagueModal } from "@/components/dashboard/leagues/league-settings/components/DeleteLeagueModal";
import { ScoringRulesEditor } from "@/components/dashboard/leagues/league-settings/components/ScoringRulesEditor";
import { SettingsForm, type LeagueSettingsData } from "@/components/dashboard/leagues/league-settings/components/SettingsForm";

const initialRulesBySport: Record<LeagueSettingsData["sport"], Record<string, number>> = {
  football: { Goal: 5, Assist: 3, "Clean Sheet": 4, Save: 1 },
  basketball: { Point: 1, Rebound: 1.2, Assist: 1.5, Steal: 2, Block: 2 },
  cricket: { Run: 1, Wicket: 20, Catch: 5, "Run Out": 5 },
  multisport: { Goal: 5, Assist: 3, "Clean Sheet": 4, Save: 1 },
};

export function LeagueSettings() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [data, setData] = useState<LeagueSettingsData>({
    leagueName: "Premier League Champions",
    sport: "football",
    isPrivate: true,
    teamSize: 10,
    draftType: "snake",
    draftDate: "",
    matchesStarted: false,
  });
  const [scoringRules, setScoringRules] = useState(initialRulesBySport.football);

  const maxTeamSizeAllowed = useMemo(() => 16, []);

  if (!isCommissioner) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <NavigationTabs activeTab="settings" leagueId={leagueId} isCommissioner={isCommissioner} />
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-600">
          Only the league commissioner can access settings.
        </div>
      </section>
    );
  }

  const handleSave = async () => {
    if (data.teamSize > maxTeamSizeAllowed) {
      toastifier.error("✕ Team size exceeds current league constraints");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setIsSaving(false);
    toastifier.success("✓ League settings saved");
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setIsDeleting(false);
    setShowDeleteModal(false);
    toastifier.success("✓ League deleted");
    router.push("/leagues");
  };

  return (
    <section className="mx-auto max-w-6xl px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <NavigationTabs activeTab="settings" leagueId={leagueId} isCommissioner={isCommissioner} />

      <SettingsForm
        data={data}
        onChange={(next) => {
          setData((prev) => {
            const merged = { ...prev, ...next };
            if (next.sport && next.sport !== prev.sport) {
              setScoringRules(initialRulesBySport[next.sport]);
            }
            return merged;
          });
        }}
      />

      <ScoringRulesEditor scoringRules={scoringRules} onChange={setScoringRules} />

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

      <DangerZone leagueName={data.leagueName} onDeleteClick={() => setShowDeleteModal(true)} />

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
