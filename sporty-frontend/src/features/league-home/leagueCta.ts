export type LeagueDraftStatus = "setup" | "drafting" | "complete";

export type LeagueCtaInput = {
  competitionType: "draft" | "budget";
  draftStatus: LeagueDraftStatus;
  isCommissioner: boolean;
  hasTeam: boolean;
};

export type LeagueCtaBanner = {
  tone: "success" | "info" | "warning" | "neutral";
  message: string;
  action: "startDraft" | "enterDraftRoom" | null;
};

export type LeagueCtaPrimary =
  | { kind: "buildOrViewTeam"; label: "Build Team" | "View Team" }
  | { kind: "openDraftScreen" }
  | { kind: "none" };

export type LeagueCta = {
  banner: LeagueCtaBanner;
  primary: LeagueCtaPrimary;
};

export function getLeagueCta({
  competitionType,
  draftStatus,
  isCommissioner,
  hasTeam,
}: LeagueCtaInput): LeagueCta {
  if (competitionType === "budget") {
    return {
      banner: {
        tone: "success",
        message: "Build your team to start competing in this budget league.",
        action: null,
      },
      primary: {
        kind: "buildOrViewTeam",
        label: hasTeam ? "View Team" : "Build Team",
      },
    };
  }

  const primary: LeagueCtaPrimary = hasTeam
    ? { kind: "none" }
    : { kind: "openDraftScreen" };

  if (draftStatus === "setup") {
    return {
      banner: {
        tone: "warning",
        message: isCommissioner
          ? "All set? Start the draft to randomise the order, create every member's team, and open the draft room. Members can't join once it starts."
          : "Draft has not started yet. Team creation happens through the draft only.",
        action: isCommissioner ? "startDraft" : null,
      },
      primary,
    };
  }

  if (draftStatus === "drafting") {
    return {
      banner: {
        tone: "info",
        message: "Draft is in progress. Make your picks from the draft screen.",
        action: "enterDraftRoom",
      },
      primary,
    };
  }

  return {
    banner: {
      tone: "neutral",
      message: "Draft is complete, but your team is not available yet.",
      action: null,
    },
    primary,
  };
}
