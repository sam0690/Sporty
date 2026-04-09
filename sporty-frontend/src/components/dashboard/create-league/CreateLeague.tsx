"use client";

import { useMemo, useState, useEffect } from "react";
import { useMe } from "@/hooks/auth/useMe";
import { CreateLeagueHeader } from "@/components/dashboard/create-league/components/CreateLeagueHeader";
import { LeagueBasicInfo } from "@/components/dashboard/create-league/components/LeagueBasicInfo";
import { LeagueSettings } from "@/components/dashboard/create-league/components/LeagueSettings";
import { ScoringSettings } from "@/components/dashboard/create-league/components/ScoringSettings";
import { SummaryStep } from "@/components/dashboard/create-league/components/SummaryStep";
import { SuccessModal } from "@/components/dashboard/create-league/components/SuccessModal";
import { useDefaultScoringRules } from "@/hooks/scoring/useScoring";
import {
  useSeasons,
  useCreateLeague,
  useSports,
} from "@/hooks/leagues/useLeagues";
import { toastifier } from "@/libs/toastifier";
import { LeagueService } from "@/services/LeagueService";
import { ScoringService } from "@/services/ScoringService";
import type { TCompetitionType } from "@/types";

type SportKey = "football" | "basketball" | "multisport";
type LeagueSportName = "football" | "basketball";

type EditableScoringRule = {
  action: string;
  description: string;
  defaultPoints: number;
  points: number;
  enabled: boolean;
};

type LeagueData = {
  leagueName: string;
  sport: SportKey;
  seasonId: string;
  leagueLogo: string;
  isPrivate: boolean;
  teamSize: number;
  competitionType: TCompetitionType;
  draftDate: string;
};

const MIN_CUSTOM_POINTS = -50;
const MAX_CUSTOM_POINTS = 50;

function mapSportSelectionToPayload(sport: SportKey): LeagueSportName[] {
  if (sport === "multisport") {
    return ["football", "basketball"];
  }

  return [sport];
}

function formatRuleLabel(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function CreateLeague() {
  const { username } = useMe();
  const { data: seasons } = useSeasons();
  const { data: sports } = useSports();
  const { data: footballRules } = useDefaultScoringRules("football");
  const { data: basketballRules } = useDefaultScoringRules("basketball");
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
  });

  const [scoringRulesBySport, setScoringRulesBySport] = useState<
    Record<LeagueSportName, EditableScoringRule[]>
  >({ football: [], basketball: [] });
  const [customScoringEnabledBySport, setCustomScoringEnabledBySport] =
    useState<Record<LeagueSportName, boolean>>({
      football: false,
      basketball: false,
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
  const selectedSports = useMemo(
    () => mapSportSelectionToPayload(leagueData.sport),
    [leagueData.sport],
  );
  const selectedSportsKey = selectedSports.join(",");

  useEffect(() => {
    if (!footballRules?.length) {
      return;
    }

    setScoringRulesBySport((prev) => {
      if (prev.football.length > 0) {
        return prev;
      }

      return {
        ...prev,
        football: footballRules.map((rule) => {
          const points = Number(rule.points);
          return {
            action: rule.action,
            description: rule.description,
            defaultPoints: points,
            points,
            enabled: false,
          };
        }),
      };
    });
  }, [footballRules]);

  useEffect(() => {
    if (!basketballRules?.length) {
      return;
    }

    setScoringRulesBySport((prev) => {
      if (prev.basketball.length > 0) {
        return prev;
      }

      return {
        ...prev,
        basketball: basketballRules.map((rule) => {
          const points = Number(rule.points);
          return {
            action: rule.action,
            description: rule.description,
            defaultPoints: points,
            points,
            enabled: false,
          };
        }),
      };
    });
  }, [basketballRules]);

  // Auto-select first season for the chosen sport if not set
  useEffect(() => {
    if (seasons && seasons.length > 0) {
      const sportSeasons = seasons.filter((s) => {
        const name = s.name.toLowerCase();
        return selectedSports.some((sport) => name.includes(sport));
      });
      if (sportSeasons.length > 0 && !leagueData.seasonId) {
        setLeagueData((prev) => ({ ...prev, seasonId: sportSeasons[0].id }));
      } else if (seasons.length > 0 && !leagueData.seasonId) {
        setLeagueData((prev) => ({ ...prev, seasonId: seasons[0].id }));
      }
    }
  }, [seasons, selectedSportsKey, leagueData.seasonId]);

  const customScoringValidationError = useMemo(() => {
    for (const sport of selectedSports) {
      if (!customScoringEnabledBySport[sport]) {
        continue;
      }

      for (const rule of scoringRulesBySport[sport]) {
        if (!rule.enabled) {
          continue;
        }

        if (
          Number.isNaN(rule.points) ||
          rule.points < MIN_CUSTOM_POINTS ||
          rule.points > MAX_CUSTOM_POINTS
        ) {
          const sportName = sport === "football" ? "Football" : "Basketball";
          return `${sportName}: '${formatRuleLabel(rule.action)}' must be a number between ${MIN_CUSTOM_POINTS} and ${MAX_CUSTOM_POINTS}.`;
        }
      }
    }

    return null;
  }, [selectedSports, customScoringEnabledBySport, scoringRulesBySport]);

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

    if (customScoringValidationError) {
      errors.push(customScoringValidationError);
    }

    return errors;
  }, [leagueData, customScoringValidationError]);

  const customOverrides = useMemo(
    () =>
      selectedSports.flatMap((sport) => {
        if (!customScoringEnabledBySport[sport]) {
          return [];
        }

        return scoringRulesBySport[sport]
          .filter((rule) => rule.enabled && rule.points !== rule.defaultPoints)
          .map((rule) => ({
            sport,
            action: rule.action,
            points: rule.points,
          }));
      }),
    [selectedSports, customScoringEnabledBySport, scoringRulesBySport],
  );

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
        sports: selectedSports,
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

      try {
        const attachedSportNames = new Set(
          (result.sports ?? []).map((leagueSport) => leagueSport.sport.name),
        );

        for (const sportName of selectedSports) {
          if (!attachedSportNames.has(sportName)) {
            await LeagueService.addSport(result.id, sportName);
          }
        }

        if (customOverrides.length > 0) {
          const sportIdByName = new Map(
            (sports ?? []).map((sport) => [sport.name, sport.id]),
          );

          const missingSportId = customOverrides.find(
            (override) => !sportIdByName.get(override.sport),
          );
          if (missingSportId) {
            throw new Error(
              `Could not resolve sport id for ${missingSportId.sport} scoring overrides.`,
            );
          }

          for (const override of customOverrides) {
            const sportId = sportIdByName.get(override.sport);
            if (!sportId) {
              continue;
            }

            await ScoringService.upsertOverride(result.id, {
              sport_id: sportId,
              action: override.action,
              points: override.points,
            });
          }
        }
      } catch {
        toastifier.error(
          "League created, but some sport/scoring customizations could not be applied.",
        );
      }

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
    }));
  };

  const handleToggleSportCustomScoring = (
    sport: LeagueSportName,
    enabled: boolean,
  ) => {
    setCustomScoringEnabledBySport((prev) => ({ ...prev, [sport]: enabled }));
  };

  const handleRuleToggle = (
    sport: LeagueSportName,
    action: string,
    enabled: boolean,
  ) => {
    setScoringRulesBySport((prev) => ({
      ...prev,
      [sport]: prev[sport].map((rule) =>
        rule.action === action
          ? {
              ...rule,
              enabled,
              points: enabled ? rule.points : rule.defaultPoints,
            }
          : rule,
      ),
    }));
  };

  const handleRulePointsChange = (
    sport: LeagueSportName,
    action: string,
    points: number,
  ) => {
    setScoringRulesBySport((prev) => ({
      ...prev,
      [sport]: prev[sport].map((rule) =>
        rule.action === action
          ? {
              ...rule,
              points,
              enabled: true,
            }
          : rule,
      ),
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
              selectedSports={selectedSports}
              scoringRulesBySport={scoringRulesBySport}
              customScoringEnabledBySport={customScoringEnabledBySport}
              onToggleSportCustomScoring={handleToggleSportCustomScoring}
              onRuleToggle={handleRuleToggle}
              onRulePointsChange={handleRulePointsChange}
              minPoints={MIN_CUSTOM_POINTS}
              maxPoints={MAX_CUSTOM_POINTS}
            />
          ) : null}

          {step === 4 ? (
            <SummaryStep
              leagueData={leagueData}
              selectedSports={selectedSports}
              scoringRulesBySport={scoringRulesBySport}
              customScoringEnabledBySport={customScoringEnabledBySport}
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
