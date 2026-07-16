import { describe, expect, it } from "vitest";
import {
  buildFavouritesOnboardingUrl,
  getSafeRedirectPath,
} from "./route.utils";

describe("buildFavouritesOnboardingUrl", () => {
  it("returns the bare onboarding path without a redirect", () => {
    expect(buildFavouritesOnboardingUrl(null)).toBe("/onboarding/favourites");
  });

  it("carries the redirect through as an encoded query param", () => {
    expect(buildFavouritesOnboardingUrl("/leagues/42?tab=standings")).toBe(
      "/onboarding/favourites?redirect=%2Fleagues%2F42%3Ftab%3Dstandings",
    );
  });
});

describe("getSafeRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/players")).toBe("/players");
  });

  it("rejects empty and null values", () => {
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath("")).toBeNull();
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(getSafeRedirectPath("//evil.com")).toBeNull();
    expect(getSafeRedirectPath("https://evil.com")).toBeNull();
    expect(getSafeRedirectPath("/path?next=https://evil.com")).toBeNull();
  });
});
