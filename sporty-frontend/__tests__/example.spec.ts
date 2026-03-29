import { test, expect } from "@playwright/test";

test("homepage loads correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Sporty/);
    await expect(page.locator("h1")).toContainText("Sporty");
});
