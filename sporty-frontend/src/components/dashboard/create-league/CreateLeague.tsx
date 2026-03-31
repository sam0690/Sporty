"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { CreateLeagueHeader } from "@/components/dashboard/create-league/components/CreateLeagueHeader";
import { LeagueBasicInfo } from "@/components/dashboard/create-league/components/LeagueBasicInfo";
import { LeagueSettings } from "@/components/dashboard/create-league/components/LeagueSettings";
import { ScoringSettings } from "@/components/dashboard/create-league/components/ScoringSettings";
import { SummaryStep } from "@/components/dashboard/create-league/components/SummaryStep";
import { SuccessModal } from "@/components/dashboard/create-league/components/SuccessModal";

type SportKey = "football" | "basketball" | "cricket" | "multisport";

type LeagueData = {
  leagueName: string;
  sport: SportKey;
  leagueLogo: string;
  isPrivate: boolean;
  teamSize: number;
  draftType: string;
  draftDate: string;
  scoringRules: Record<string, number>;
};

type CreatedLeague = {
  id: string;
  name: string;
  sport: SportKey;
  isPrivate: boolean;
  inviteCode: string;
  teamSize: number;
  draftType: string;
};

const mockCreatedLeague: CreatedLeague = {
  id: "5",
  name: "Champions League 2025",
  sport: "football",
  isPrivate: true,
  inviteCode: "CHAMP-2025-FOOT",
  teamSize: 10,
  draftType: "snake",
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
  cricket: {
    Run: 1,
    Wicket: 20,
    Catch: 5,
    "Run Out": 5,
  },
  multisport: {
    Goal: 5,
    Assist: 3,
    "Clean Sheet": 4,
    Save: 1,
  },
};

export function CreateLeague() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [leagueData, setLeagueData] = useState<LeagueData>({
    leagueName: "",
    sport: "football",
    leagueLogo: "",
    isPrivate: false,
    teamSize: 10,
    draftType: "snake",
    draftDate: "",
    scoringRules: scoringDefaults.football,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdLeague, setCreatedLeague] = useState<CreatedLeague | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!leagueData.leagueName.trim()) {
      errors.push("League name is required.");
    }

    if (!leagueData.sport) {
      errors.push("Sport selection is required.");
    }

    if (leagueData.teamSize < 4 || leagueData.teamSize > 16 || leagueData.teamSize % 2 !== 0) {
      errors.push("Team size must be an even number between 4 and 16.");
    }

    const invalidRule = Object.values(leagueData.scoringRules).some((value) => value < 0);
    if (invalidRule) {
      errors.push("Scoring rules must be zero or greater.");
    }

    return errors;
  }, [leagueData]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!leagueData.leagueName.trim()) {
        setError("League name is required.");
        return;
      }
    }

    if (step === 2) {
      if (leagueData.teamSize % 2 !== 0 || leagueData.teamSize < 4 || leagueData.teamSize > 16) {
        setError("Team size must be an even number between 4 and 16.");
        return;
      }
    }

    if (step === 3) {
      const invalidRule = Object.values(leagueData.scoringRules).some((value) => value < 0);
      if (invalidRule) {
        setError("Scoring rules must be zero or greater.");
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
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result: CreatedLeague = {
      ...mockCreatedLeague,
      name: leagueData.leagueName || mockCreatedLeague.name,
      sport: leagueData.sport,
      isPrivate: leagueData.isPrivate,
      teamSize: leagueData.teamSize,
      draftType: leagueData.draftType,
    };

    setCreatedLeague(result);
    setIsLoading(false);
    setShowSuccessModal(true);
  };

  const handleLeagueNameChange = (value: string) => {
    setLeagueData((prev) => ({ ...prev, leagueName: value }));
  };

  const handleSportChange = (value: string) => {
    const sport = value as SportKey;
    setLeagueData((prev) => ({
      ...prev,
      sport,
      scoringRules: scoringDefaults[sport] ?? scoringDefaults.football,
    }));
  };

  const handleSettingsChange = (next: {
    isPrivate?: boolean;
    teamSize?: number;
    draftType?: string;
    draftDate?: string;
  }) => {
    setLeagueData((prev) => ({
      ...prev,
      ...next,
    }));
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6 px-6 py-8 text-gray-900 [font-family:system-ui,-apple-system]">
      <p className="text-sm text-gray-500">Manager: {user?.name ?? "Sporty User"}</p>

      <CreateLeagueHeader step={step} totalSteps={totalSteps} leagueName={leagueData.leagueName} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-8 [animation:fade-soft_0.2s_ease]">
        <div className="mt-2">
          {step === 1 ? (
            <LeagueBasicInfo
              leagueName={leagueData.leagueName}
              sport={leagueData.sport}
              leagueLogo={leagueData.leagueLogo}
              onLeagueNameChange={handleLeagueNameChange}
              onSportChange={handleSportChange}
              onLeagueLogoChange={(value) => setLeagueData((prev) => ({ ...prev, leagueLogo: value }))}
            />
          ) : null}

          {step === 2 ? (
            <LeagueSettings
              isPrivate={leagueData.isPrivate}
              teamSize={leagueData.teamSize}
              draftType={leagueData.draftType}
              draftDate={leagueData.draftDate}
              onSettingsChange={handleSettingsChange}
            />
          ) : null}

          {step === 3 ? (
            <ScoringSettings
              scoringRules={leagueData.scoringRules}
              onScoringChange={(next) => setLeagueData((prev) => ({ ...prev, scoringRules: next }))}
              sport={leagueData.sport}
            />
          ) : null}

          {step === 4 ? (
            <SummaryStep
              leagueData={leagueData}
              onBack={handlePreviousStep}
              onCreate={handleCreateLeague}
              isLoading={isLoading}
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
              <span className="hidden sm:block" />
            )}
            <button
              type="button"
              onClick={handleNextStep}
              className="w-full rounded-full bg-[#247BA0] px-8 py-2.5 font-semibold !text-white shadow-sm hover:bg-[#1d6280] sm:w-auto"
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
          setStep(1);
        }}
        leagueId={createdLeague?.id ?? mockCreatedLeague.id}
        leagueName={createdLeague?.name ?? mockCreatedLeague.name}
        inviteCode={createdLeague?.inviteCode ?? mockCreatedLeague.inviteCode}
        isPrivate={createdLeague?.isPrivate ?? mockCreatedLeague.isPrivate}
      />
    </section>
  );
}
