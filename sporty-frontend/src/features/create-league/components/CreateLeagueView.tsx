"use client";

import { useMemo, useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CreateLeagueHeader } from "@/components/dashboard/create-league/components/CreateLeagueHeader";
import { LeagueBasicInfo } from "@/components/dashboard/create-league/components/LeagueBasicInfo";
import { LeagueSettings } from "@/components/dashboard/create-league/components/LeagueSettings";
import { SummaryStep } from "@/components/dashboard/create-league/components/SummaryStep";
import { SuccessModal } from "@/components/dashboard/create-league/components/SuccessModal";
import { useDefaultScoringRules } from "@/hooks/scoring/useScoring";
import { useSeasons, useCreateLeague } from "@/hooks/leagues/useLeagues";
import { CreateLeagueSchema, type CreateLeagueValues } from "@/lib/validations";
import type { TCompetitionType } from "@/types";

type SportKey = "football" | "basketball" | "multisport";
type LeagueSportName = "football" | "basketball";

type ScoringRuleDisplay = {
  action: string;
  description: string;
  points: number;
};

function mapSportSelectionToPayload(sport: SportKey): LeagueSportName[] {
  if (sport === "multisport") {
    return ["football", "basketball"];
  }

  return [sport];
}

function normalizeScoringRules(
  rules?: { action: string; description: string; points: number | string }[],
): ScoringRuleDisplay[] {
  return (rules ?? []).map((rule) => ({
    action: rule.action,
    description: rule.description,
    points: Number(rule.points),
  }));
}

export function CreateLeagueView() {
  const { data: seasons } = useSeasons();
  const { data: footballRules } = useDefaultScoringRules("football");
  const { data: basketballRules } = useDefaultScoringRules("basketball");
  const createMutation = useCreateLeague();
  const prefersReducedMotion = useReducedMotion();

  const [step, setStep] = useState(1);
  const [draftDate, setDraftDate] = useState("");
  const [seasonId, setSeasonId] = useState("");
  // Drives the step-transition slide direction (Next → forward, Back → backward).
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

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
      max_teams: 10,
      squad_size: 15,
      draft_mode: false,
      is_public: true,
    },
    mode: "onSubmit",
  });

  const leagueName = useWatch({ control, name: "name" }) ?? "";
  const sportIds = useWatch({ control, name: "sport_ids" });
  const maxTeams = useWatch({ control, name: "max_teams" }) ?? 10;
  const draftMode = useWatch({ control, name: "draft_mode" }) ?? false;
  const isPublic = useWatch({ control, name: "is_public" }) ?? true;

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdLeagueInfo, setCreatedLeagueInfo] = useState<{
    id: string;
    name: string;
    inviteCode: string;
    isPrivate: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Flow: Basic Info → Settings → Summary.
  const totalSteps = 3;
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
      isPrivate: !isPublic,
      teamSize: maxTeams,
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
      effectiveSeasonId,
      selectedSports,
      maxTeams,
    ],
  );

  const scoringRulesBySport: Record<LeagueSportName, ScoringRuleDisplay[]> = useMemo(
    () => ({
      football: normalizeScoringRules(footballRules),
      basketball: normalizeScoringRules(basketballRules),
    }),
    [basketballRules, footballRules],
  );

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

    setStepDirection(1);
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handlePreviousStep = () => {
    setError(null);
    setStepDirection(-1);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCreateLeague = handleSubmit(async (values) => {
    setError(null);
    try {
      const competitionType = values.draft_mode ? "draft" : "budget";
      const result = await createMutation.mutateAsync({
        name: values.name,
        season_id: effectiveSeasonId,
        sports: selectedSports,
        competitionType,
        is_public: values.is_public,
        max_teams: values.max_teams,
        squad_size: values.squad_size,
        budget_per_team: values.budget,
        draft_mode: values.draft_mode,
        allow_midseason_join: competitionType === "budget",
        transfers_per_window: 4,
        transfer_day: 1,
      });

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
    const sportPayload = mapSportSelectionToPayload(sport);
    setValue("sport_ids", sportPayload, {
      shouldDirty: true,
      shouldValidate: true,
    });

    // Auto-update squad size based on sport
    let newSquadSize = 15;
    if (sport === "basketball") {
      newSquadSize = 13;
    } else if (sport === "football" || sport === "multisport") {
      newSquadSize = 15;
    }

    setValue("squad_size", newSquadSize, {
      shouldDirty: true,
      shouldValidate: true,
    });

    setSeasonId("");
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
      setValue("max_teams", next.teamSize, {
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
    <section className="mx-auto max-w-3xl space-y-6 px-6 py-8 text-fg-1">
      <CreateLeagueHeader
        step={step}
        totalSteps={totalSteps}
        leagueName={leagueData.leagueName}
        sport={leagueData.sport}
        teamSize={step >= 2 ? leagueData.teamSize : undefined}
        competitionType={step >= 2 ? leagueData.competitionType : undefined}
      />

      {displayError ? (
        <div className="rounded-[3px] border border-[rgba(255,59,48,0.25)] bg-[rgba(255,59,48,0.08)] px-4 py-2.5 text-sm text-danger-soft">
          {displayError}
        </div>
      ) : null}

      <div className="overflow-hidden card-surface p-6 sm:p-8">
        <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
          <motion.div
            key={step}
            custom={stepDirection}
            variants={
              prefersReducedMotion
                ? undefined
                : {
                    enter: (direction: 1 | -1) => ({
                      x: direction > 0 ? 24 : -24,
                      opacity: 0,
                    }),
                    center: { x: 0, opacity: 1 },
                    exit: (direction: 1 | -1) => ({
                      x: direction > 0 ? -24 : 24,
                      opacity: 0,
                    }),
                  }
            }
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {step === 1 ? (
              <LeagueBasicInfo
                leagueName={leagueData.leagueName}
                sport={leagueData.sport}
                onLeagueNameChange={handleLeagueNameChange}
                onSportChange={handleSportChange}
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

            {step === totalSteps ? (
              <SummaryStep
                leagueData={leagueData}
                selectedSports={selectedSports}
                scoringRulesBySport={scoringRulesBySport}
                onBack={handlePreviousStep}
                onCreate={handleCreateLeague}
                isLoading={createMutation.isPending}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>

        {step < totalSteps ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <motion.button
                type="button"
                onClick={handlePreviousStep}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                className="w-full rounded-[3px] border border-white/8 bg-surface-3 px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-fg-2 transition-colors hover:text-fg-1 sm:w-auto"
              >
                Back
              </motion.button>
            ) : (
              <div className="hidden sm:block" />
            )}
            <motion.button
              type="button"
              onClick={handleNextStep}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
              className="w-full rounded-[3px] bg-accent px-8 py-2.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright sm:w-auto"
            >
              Next
            </motion.button>
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
