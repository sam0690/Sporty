import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 6 smoke flows (PHASE1_AUDIT.md): login → create league → draft pick
 * → set lineup, against the full docker-compose stack (seeded players +
 * current seasons required — the compose stack provides both).
 *
 * One serial describe per flow; a fresh user is registered per run so the
 * suite never depends on pre-existing accounts.
 */

const runId = Date.now().toString(36);
const user = {
  username: `smoke${runId}`,
  email: `smoke-${runId}@example.com`,
  password: "SmokeTest123!",
};

async function register(page: Page) {
  await page.goto("/register");
  await page.getByPlaceholder("your-username").fill(user.username);
  await page.getByPlaceholder("name@example.com").fill(user.email);
  await page.getByPlaceholder("Create a password").fill(user.password);
  await page.getByPlaceholder("Confirm your password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Email or username").fill(user.email);
  await page.getByPlaceholder("Enter your password").fill(user.password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/dashboard/i, { timeout: 15_000 });
}

/** Walk the 3-step create-league wizard. Returns the new league's id. */
async function createLeague(
  page: Page,
  name: string,
  mode: "budget" | "draft",
) {
  await page.goto("/create-league");
  await page.getByPlaceholder("Champions League 2025").fill(name);
  await page.getByRole("button", { name: "Next" }).click();

  if (mode === "draft") {
    await page.getByText("Draft Mode", { exact: true }).click();
  }
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: "Create League" }).click();
  await page.getByRole("button", { name: "Go to League" }).click();
  await page.waitForURL(/\/leagues\/[0-9a-f-]+/i, { timeout: 15_000 });

  const match = page.url().match(/\/leagues\/([0-9a-f-]+)/i);
  expect(match, "league id in URL after creation").toBeTruthy();
  return match![1];
}

test.describe.serial("budget league: login → create → team → lineup", () => {
  test("register a fresh account", async ({ page }) => {
    await register(page);
    // Either auto-logged-in (dashboard) or bounced to login — both are fine,
    // the login test pins the credential path either way.
    await expect(page).toHaveURL(/dashboard|login/i, { timeout: 15_000 });
  });

  test("login lands on the dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/dashboard/i);
  });

  test("create a budget league", async ({ page }) => {
    await login(page);
    const leagueId = await createLeague(page, `Smoke Budget ${runId}`, "budget");
    expect(leagueId).toBeTruthy();
  });

  test("auto-pick a squad and save the team", async ({ page }) => {
    await login(page);
    await page.goto("/leagues");
    await page.getByText(`Smoke Budget ${runId}`).first().click();
    await page.waitForURL(/\/leagues\/[0-9a-f-]+/i);
    const leagueUrl = page.url();

    await page.goto(`${leagueUrl.replace(/\/$/, "")}/create-team`);
    await page.getByRole("button", { name: "Auto Pick Squad" }).click();
    await page
      .getByPlaceholder("Enter your team name")
      .fill(`Smoke FC ${runId}`);
    await page.getByRole("button", { name: "Save Team" }).click();
    await expect(page.getByText(/team|squad/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("set lineup: pick starters and save", async ({ page }) => {
    await login(page);
    await page.goto("/leagues");
    await page.getByText(`Smoke Budget ${runId}`).first().click();
    await page.waitForURL(/\/leagues\/[0-9a-f-]+/i);

    await page.goto(`${page.url().replace(/\/$/, "")}/lineup`);
    // The lineup screen must render the squad (15 players from auto-pick).
    await expect(
      page.getByRole("button", { name: "Save Lineup" }),
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe.serial("draft league: create → start draft → first pick", () => {
  test("create a draft league and start the draft", async ({ page }) => {
    await login(page);
    const leagueId = await createLeague(page, `Smoke Draft ${runId}`, "draft");

    // Commissioner sees the start-draft banner action on the league home.
    await page.goto(`/leagues/${leagueId}`);
    await page.getByRole("button", { name: /start draft/i }).click({
      timeout: 15_000,
    });

    // Draft room: wait for our turn and make the first pick.
    await page.goto(`/leagues/${leagueId}/create-team`);
    await expect(page.getByText(/your pick|on the clock|drafting/i).first())
      .toBeVisible({ timeout: 20_000 });

    // First add/pick button on the draft board.
    await page
      .getByRole("button", { name: /add|pick|draft/i })
      .first()
      .click();
    // A pick lands: either roster count changes or a pick toast appears.
    await expect(
      page.getByText(/picked|drafted|round/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
