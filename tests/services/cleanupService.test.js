const { describe, it, expect } = require("vitest");
const { normalizeTarget, estimateCleanup } = require("../../services/cleanupService");

describe("cleanupService", () => {
  it("normalizes cleanup target ids", () => {
    expect(normalizeTarget("UserTemp")).toBe("usertemp");
  });

  it("returns only selected cleanup candidates", () => {
    const candidates = [
      { id: "userTemp", label: "User Temp Folder", path: "X", risky: false },
      { id: "recycleBin", label: "Recycle Bin", path: "$Recycle.Bin", risky: true }
    ];
    const result = estimateCleanup(candidates, ["recycleBin"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("recycleBin");
  });
});
