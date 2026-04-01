const { describe, it, expect } = require("vitest");
const { classifyRisk } = require("../../services/securityService");

describe("securityService", () => {
  it("classifies suspicious items", () => {
    expect(classifyRisk({ itemPath: "C:\\x\\trojan.exe", source: "engine" })).toBe("critical");
    expect(classifyRisk({ itemPath: "C:\\x\\unknown.exe", source: "scan" })).toBe("medium");
    expect(classifyRisk({ itemPath: "C:\\x\\safe.exe", source: "signed" })).toBe("low");
  });
});
