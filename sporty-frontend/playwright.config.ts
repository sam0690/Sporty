import { defineConfig, devices } from "@playwright/test";

/**
 * E2E smoke tests. They need the FULL stack running first:
 *
 *   docker compose up        # at the repo root (postgres + redis + api + frontend)
 *   yarn test:e2e
 *
 * Override the target with PLAYWRIGHT_BASE_URL when the frontend runs
 * elsewhere. No webServer block on purpose: the flows exercise real backend
 * state (auth, league creation, drafting), which a frontend-only server
 * can't provide.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  // Flows build on backend state created by earlier steps — never parallel.
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
