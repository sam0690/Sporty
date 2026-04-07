"use client";

import { useMemo, useState, useEffect } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { CreateLeagueHeader } from "@/components/dashboard/create-league/components/CreateLeagueHeader";
import { LeagueBasicInfo } from "@/components/dashboard/create-league/components/LeagueBasicInfo";
import { LeagueSettings } from "@/components/dashboard/create-league/components/LeagueSettings";
import { ScoringSettings } from "@/components/dashboard/create-league/components/ScoringSettings";
import { SummaryStep } from "@/components/dashboard/create-league/components/SummaryStep";
import { SuccessModal } from "@/components/dashboard/create-league/components/SuccessModal";
import { useSeasons, useCreateLeague } from "@/hooks/leagues/useLeagues";
import type { TCompetitionType } from "@/types";

type SportKey = "football" | "basketball" | "multisport";

type LeagueData = {
  leagueName: string;
  sport: SportKey;
  seasonId: string;
  leagueLogo: string;
  isPrivate: boolean;
  teamSize: number;
  competitionType: TCompetitionType;
  draftDate: string;
  scoringRules: Record<string, number>;
};

const scoringDefaults: Record<SportKey, Record<string, number>> = {
  football: {
    Goal: 5,
    Assist: 3,
    "Clean Sheet": 4,
    Save: 1,
  },
  basketball: {
    Point: 1,
    Rebound: 1.2,
    Assist: 1.5,
    Steal: 2,
    Block: 2,
  },
  multisport: {
    Goal: 5,
    Assist: 3,
    "Clean Sheet": 4,
    Save: 1,
  },
};

export function CreateLeague() {
  const { username } = useMe();
  const { data: seasons } = useSeasons();
  const createMutation = useCreateLeague();

  const [step, setStep] = useState(1);
  const [leagueData, setLeagueData] = useState<LeagueData>({
    leagueName: "",
    sport: "football",
    seasonId: "",
    leagueLogo: "",
    isPrivate: false,
    teamSize: 10,
    competitionType: "draft",
    draftDate: "",
    scoringRules: scoringDefaults.football,
  });

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdLeagueInfo, setCreatedLeagueInfo] = useState<{
    id: string;
    name: string;
    inviteCode: string;
    isPrivate: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;

  // Auto-select first season for the chosen sport if not set
  useEffect(() => {
    if (seasons && seasons.length > 0) {
      const sportSeasons = seasons.filter(
        (s) =>
          s.name.toLowerCase().includes(leagueData.sport) ||
          seasons.length === 1,
      );
      if (sportSeasons.length > 0 && !leagueData.seasonId) {
        setLeagueData((prev) => ({ ...prev, seasonId: sportSeasons[0].id }));
      } else if (seasons.length > 0 && !leagueData.seasonId) {
        setLeagueData((prev) => ({ ...prev, seasonId: seasons[0].id }));
      }
    }
  }, [seasons, leagueData.sport]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!leagueData.leagueName.trim()) {
      errors.push("League name is required.");
    }

    if (!leagueData.seasonId) {
      errors.push("A valid season must be active for this sport.");
    }

    if (leagueData.teamSize < 2 || leagueData.teamSize > 64) {
      errors.push("Team size must be between 2 and 64.");
    }

    return errors;
  }, [leagueData]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!leagueData.leagueName.trim()) {
        setError("League name is required.");
        return;
      }
      if (!leagueData.seasonId) {
        setError(
          "No active season found for this sport. Please contact admin.",
        );
        return;
      }
    }

    setError(null);
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePreviousStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreateLeague = async () => {
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setError(null);
    try {
      const competitionType = leagueData.competitionType;
      const result = await createMutation.mutateAsync({
        name: leagueData.leagueName,
        season_id: leagueData.seasonId,
        competitionType,
        is_public: !leagueData.isPrivate,
        max_teams: leagueData.teamSize,
        draft_mode: competitionType === "draft",
        // Default values for other fields
        squad_size: 15,
        budget_per_team: 100,
        transfers_per_window: 4,
        transfer_day: 1,
      });

      setCreatedLeagueInfo({
        id: result.id,
        name: result.name,
        inviteCode: result.invite_code,
        isPrivate: !result.is_public,
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail || err.message || "Failed to create league",
      );
    }
  };

  const handleLeagueNameChange = (value: string) => {
    setLeagueData((prev) => ({ ...prev, leagueName: value }));
  };

  const handleSportChange = (value: string) => {
    const sport = value as SportKey;
    // Reset seasonId when sport changes so useEffect re-selects
    setLeagueData((prev) => ({
      ...prev,
      sport,
      seasonId: "",
      scoringRules: scoringDefaults[sport] ?? scoringDefaults.football,
    }));
  };

  const handleSettingsChange = (next: {
    isPrivate?: boolean;
    teamSize?: number;
    competitionType?: TCompetitionType;
    draftDate?: string;
  }) => {
    setLeagueData((prev) => ({
      ...prev,
      ...next,
    }));
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-6 py-8 text-gray-900 font-[system-ui,-apple-system]">
      <p className="text-sm text-gray-500">
        Manager: {username || "Sporty User"}
      </p>

      <CreateLeagueHeader
        step={step}
        totalSteps={totalSteps}
        leagueName={leagueData.leagueName}
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-8 animate-[fade-soft_0.2s_ease]">
        <div className="mt-2">
          {step === 1 ? (
            <LeagueBasicInfo
              leagueName={leagueData.leagueName}
              sport={leagueData.sport}
              leagueLogo={leagueData.leagueLogo}
              onLeagueNameChange={handleLeagueNameChange}
              onSportChange={handleSportChange}
              onLeagueLogoChange={(value) =>
                setLeagueData((prev) => ({ ...prev, leagueLogo: value }))
              }
            />
          ) : null}

          {step === 2 ? (
            <LeagueSettings
              isPrivate={leagueData.isPrivate}
              teamSize={leagueData.teamSize}
              competitionType={leagueData.competitionType}
              draftDate={leagueData.draftDate}
              onSettingsChange={handleSettingsChange as any}
            />
          ) : null}

          {step === 3 ? (
            <ScoringSettings
              scoringRules={leagueData.scoringRules}
              onScoringChange={(next) =>
                setLeagueData((prev) => ({ ...prev, scoringRules: next }))
              }
              sport={leagueData.sport}
            />
          ) : null}

          {step === 4 ? (
            <SummaryStep
              leagueData={leagueData as any}
              onBack={handlePreviousStep}
              onCreate={handleCreateLeague}
              isLoading={createMutation.isPending}
            />
          ) : null}
        </div>

        {step < totalSteps ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={handlePreviousStep}
                className="w-full rounded-full border border-gray-300 bg-white px-8 py-2.5 font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
              >
                Back
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full rounded-full bg-[#247BA0] px-8 py-2.5 font-semibold text-white shadow-sm hover:bg-[#1d6280] sm:w-auto"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          window.location.href = "/leagues";
        }}
        leagueId={createdLeagueInfo?.id ?? ""}
        leagueName={createdLeagueInfo?.name ?? ""}
        inviteCode={createdLeagueInfo?.inviteCode ?? ""}
        isPrivate={createdLeagueInfo?.isPrivate ?? false}
      />
    </section>
  );
}
