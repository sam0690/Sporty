import { getLeagueCta } from "./leagueCta";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
}

function demo() {
  assertEqual(
    getLeagueCta({ competitionType: "budget", draftStatus: "setup", isCommissioner: false, hasTeam: false }).primary,
    { kind: "buildOrViewTeam", label: "Build Team" },
    "budget, no team -> Build Team",
  );

  assertEqual(
    getLeagueCta({ competitionType: "budget", draftStatus: "setup", isCommissioner: false, hasTeam: true }).primary,
    { kind: "buildOrViewTeam", label: "View Team" },
    "budget, has team -> View Team",
  );

  const setupCommish = getLeagueCta({ competitionType: "draft", draftStatus: "setup", isCommissioner: true, hasTeam: false });
  assertEqual(setupCommish.banner.action, "startDraft", "draft/setup/commissioner -> startDraft action");
  assertEqual(setupCommish.primary, { kind: "openDraftScreen" }, "draft/setup, no team -> openDraftScreen");

  const setupMember = getLeagueCta({ competitionType: "draft", draftStatus: "setup", isCommissioner: false, hasTeam: false });
  assertEqual(setupMember.banner.action, null, "draft/setup/member -> no action");

  const drafting = getLeagueCta({ competitionType: "draft", draftStatus: "drafting", isCommissioner: false, hasTeam: false });
  assertEqual(drafting.banner.action, "enterDraftRoom", "draft/drafting -> enterDraftRoom action");
  assertEqual(drafting.primary, { kind: "openDraftScreen" }, "draft/drafting, no team -> openDraftScreen");

  const draftingHasTeam = getLeagueCta({ competitionType: "draft", draftStatus: "drafting", isCommissioner: false, hasTeam: true });
  assertEqual(draftingHasTeam.primary, { kind: "none" }, "draft/drafting, has team -> none (EmptyState fallback)");

  const complete = getLeagueCta({ competitionType: "draft", draftStatus: "complete", isCommissioner: false, hasTeam: false });
  assertEqual(complete.banner.action, null, "draft/complete -> no banner action");
  assertEqual(complete.primary, { kind: "openDraftScreen" }, "draft/complete, no team -> openDraftScreen");

  console.log("leagueCta: all assertions passed");
}

demo();
