import { describe, expect, it } from "vitest";

import { POSITION_LABELS, POSITION_MAP } from "./playerPositions";

describe("playerPositions", () => {
  it("every filter value (except 'All') is a DB position code with a display label", () => {
    for (const codes of Object.values(POSITION_MAP)) {
      for (const code of codes.filter((c) => c !== "All")) {
        expect(code).toBe(code.toUpperCase());
        expect(POSITION_LABELS[code]).toBeDefined();
      }
    }
  });
});
