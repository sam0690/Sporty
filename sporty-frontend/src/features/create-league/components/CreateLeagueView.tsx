"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { CreateLeagueSchema, type CreateLeagueValues } from "@/lib/validations";
import { toastifier } from "@/lib/toastifier";
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

function normalizeScoringRules(
  rules?: { action: string; description: string; points: number | string }[],
): EditableScoringRule[] {
  return (rules ?? []).map((rule) => {
    const points = Number(rule.points);

    return {
      action: rule.action,
      description: rule.description,
      defaultPoints: points,
      points,
      enabled: false,
    };
  });
}

export function CreateLeagueView() {
  const { username } = useMe();
  const { data: seasons } = useSeasons();
  const { data: sports } = useSports();
  const { data: footballRules } = useDefaultScoringRules("football");
  const { data: basketballRules } = useDefaultScoringRules("basketball");
  const createMutation = useCreateLeague();

  const [step, setStep] = useState(1);
  const [leagueLogo, setLeagueLogo] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [seasonId, setSeasonId] = useState("");

  const {
    control,
    setValue,
    trigger,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateLeagueValues>({
    resolver: zodResolver(CreateLeagueSchema) as unknown as Resolver<
      CreateLeagueValues,
      unknown,
      CreateLeagueValues
    >,
    defaultValues: {
      name: "",
      sport_ids: ["football"],
      budget: 103,
      squad_size: 10,
      draft_mode: true,
      is_public: true,
    },
    mode: "onSubmit",
  });

  const leagueName = useWatch({ control, name: "name" }) ?? "";
  const sportIds = useWatch({ control, name: "sport_ids" });
  const squadSize = useWatch({ control, name: "squad_size" }) ?? 10;
  const draftMode = useWatch({ control, name: "draft_mode" }) ?? true;
  const isPublic = useWatch({ control, name: "is_public" }) ?? true;

  const [customScoringEnabledBySport, setCustomScoringEnabledBySport] =
    useState<Record<LeagueSportName, boolean>>({
      football: false,
      basketball: false,
    });
  const [editableScoringRulesBySport, setEditableScoringRulesBySport] =
    useState<Record<LeagueSportName, EditableScoringRule[]>>({
      football: [],
      basketball: [],
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
  const selectedSports = useMemo(() => {
    const currentSportIds = sportIds ?? ["football"];

    return currentSportIds.length > 1
      ? (currentSportIds as LeagueSportName[])
      : mapSportSelectionToPayload(
          (currentSportIds[0] as SportKey) ?? "football",
        );
  }, [sportIds]);

  const defaultSeasonId = useMemo(() => {
    if (!seasons || seasons.length === 0) {
      return "";
    }

    const sportSeasons = seasons.filter((s) => {
      const name = s.name.toLowerCase();
      return selectedSports.some((sport) => name.includes(sport));
    });
    const firstSportSeasonId = sportSeasons.find((season) => season.id)?.id;
    const firstAnySeasonId = seasons.find((season) => season.id)?.id;

    return firstSportSeasonId || firstAnySeasonId || "";
  }, [seasons, selectedSports]);

  const effectiveSeasonId = seasonId || defaultSeasonId;

  const leagueData = useMemo(
    () => ({
      leagueName,
      sport:
        selectedSports.length > 1
          ? ("multisport" as SportKey)
          : ((selectedSports[0] as SportKey) ?? "football"),
      seasonId: effectiveSeasonId,
      leagueLogo,
      isPrivate: !isPublic,
      teamSize: squadSize,
      competitionType: draftMode
        ? ("draft" as TCompetitionType)
        : ("budget" as TCompetitionType),
      draftDate,
    }),
    [
      draftDate,
      draftMode,
      isPublic,
      leagueName,
      leagueLogo,
      effectiveSeasonId,
      selectedSports,
      squadSize,
    ],
  );

  const defaultScoringRulesBySport = useMemo(
    () => ({
      football: normalizeScoringRules(footballRules),
      basketball: normalizeScoringRules(basketballRules),
    }),
    [basketballRules, footballRules],
  );

  const scoringRulesBySport = useMemo(
    () => ({
      football:
        editableScoringRulesBySport.football.length > 0
          ? editableScoringRulesBySport.football
          : defaultScoringRulesBySport.football,
      basketball:
        editableScoringRulesBySport.basketball.length > 0
          ? editableScoringRulesBySport.basketball
          : defaultScoringRulesBySport.basketball,
    }),
    [defaultScoringRulesBySport, editableScoringRulesBySport],
  );

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

  const schemaError =
    step === 1
      ? errors.name?.message || errors.sport_ids?.message
      : step === 2
        ? errors.budget?.message ||
          errors.squad_size?.message ||
          errors.draft_mode?.message ||
          errors.is_public?.message
        : null;

  const displayError = schemaError || error;

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

  const handleNextStep = async () => {
    setError(null);

    const fields =
      step === 1
        ? (["name", "sport_ids"] as const)
        : (["budget", "squad_size", "draft_mode", "is_public"] as const);

    const isValid = await trigger(fields);
    if (!isValid) {
      return;
    }

    if (step === 1) {
      if (!effectiveSeasonId) {
        setError(
          "No active season found for this sport. Please contact admin.",
        );
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePreviousStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreateLeague = handleSubmit(async (values) => {
    if (customScoringValidationError) {
      setError(customScoringValidationError);
      return;
    }

    setError(null);
    try {
      const competitionType = values.draft_mode ? "draft" : "budget";
      const result = await createMutation.mutateAsync({
        name: values.name,
        season_id: effectiveSeasonId,
        sports: values.sport_ids,
        competitionType,
        is_public: values.is_public,
        max_teams: values.squad_size,
        squad_size: values.squad_size,
        budget_per_team: values.budget,
        draft_mode: values.draft_mode,
        allow_midseason_join: competitionType === "budget",
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
        inviteCode: result.invite_code ?? "",
        isPrivate: !result.is_public,
      });
      setShowSuccessModal(true);
    } catch (err: unknown) {
      const fallback = "Failed to create league";
      if (
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        typeof (err as { response?: unknown }).response === "object" &&
        (err as { response?: { data?: { detail?: unknown } } }).response?.data
          ?.detail
      ) {
        const detail = (err as { response?: { data?: { detail?: unknown } } })
          .response?.data?.detail;
        setError(typeof detail === "string" ? detail : fallback);
      } else if (err instanceof Error) {
        setError(err.message || fallback);
      } else {
        setError(fallback);
      }
    }
  });

  const handleLeagueNameChange = (value: string) => {
    setValue("name", value, { shouldDirty: true, shouldValidate: true });
  };

  const handleSportChange = (value: string) => {
    const sport = value as SportKey;
    setValue("sport_ids", mapSportSelectionToPayload(sport), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSeasonId("");
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
    setEditableScoringRulesBySport((prev) => ({
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
    setEditableScoringRulesBySport((prev) => ({
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
    if (typeof next.isPrivate === "boolean") {
      setValue("is_public", !next.isPrivate, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (typeof next.teamSize === "number") {
      setValue("squad_size", next.teamSize, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (typeof next.competitionType === "string") {
      setValue("draft_mode", next.competitionType === "draft", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (typeof next.draftDate === "string") {
      setDraftDate(next.draftDate);
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-6 py-8 font-[system-ui,-apple-system] text-foreground">
      <p className="text-sm text-foreground/60">
        Manager: {username || "Sporty User"}
      </p>

      <CreateLeagueHeader
        step={step}
        totalSteps={totalSteps}
        leagueName={leagueData.leagueName}
      />

      {displayError ? (
        <div className="rounded-md border border-danger/20 bg-danger/5 px-4 py-2 text-sm text-danger">
          {displayError}
        </div>
      ) : null}

      <div className="animate-[fade-soft_0.2s_ease] rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="mt-2">
          {step === 1 ? (
            <LeagueBasicInfo
              leagueName={leagueData.leagueName}
              sport={leagueData.sport}
              leagueLogo={leagueData.leagueLogo}
              onLeagueNameChange={handleLeagueNameChange}
              onSportChange={handleSportChange}
              onLeagueLogoChange={(value) => setLeagueLogo(value)}
            />
          ) : null}

          {step === 2 ? (
            <LeagueSettings
              isPrivate={leagueData.isPrivate}
              teamSize={leagueData.teamSize}
              competitionType={leagueData.competitionType}
              draftDate={leagueData.draftDate}
              onSettingsChange={handleSettingsChange}
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
                className="w-full rounded-full border border-white/10 bg-white/5 px-8 py-2.5 font-medium text-foreground transition-colors hover:bg-white/10 sm:w-auto"
              >
                Back
              </button>
            ) : (
              <div className="hidden sm:block" />
            )}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full rounded-full bg-accent-primary px-8 py-2.5 font-semibold text-black shadow-sm transition-colors hover:bg-accent-secondary sm:w-auto"
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
