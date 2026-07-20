import { describe, expect, it } from "vitest";
import { idFromSlug, profileSlug } from "./profileSlug";

describe("profileSlug", () => {
  it("round-trips the id through a slug", () => {
    const slug = profileSlug("Erling Håland", "a1b2-c3");
    expect(slug).toBe("erling-haland~a1b2-c3");
    expect(idFromSlug(slug)).toBe("a1b2-c3");
  });

  it("falls back to the bare id when the name is empty", () => {
    expect(profileSlug("", "xyz")).toBe("xyz");
    expect(profileSlug(null, "xyz")).toBe("xyz");
  });

  it("parses legacy id-only links (no separator)", () => {
    expect(idFromSlug("plainid123")).toBe("plainid123");
  });
});
