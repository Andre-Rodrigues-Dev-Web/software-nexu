const { describe, it, expect, vi, beforeEach } = require("vitest");

const runSpy = vi.fn(() => ({ lastInsertRowid: 11 }));
const allSpy = vi.fn(() => []);
const prepareSpy = vi.fn(() => ({ run: runSpy, all: allSpy }));

vi.mock("../../database/db", () => ({
  getDb: () => ({ prepare: prepareSpy })
}));

const { createActionLog, listActionLogs } = require("../../database/repositories/actionLogRepository");
const { getAllSettings, upsertSetting } = require("../../database/repositories/settingsRepository");

describe("repositories", () => {
  beforeEach(() => {
    runSpy.mockClear();
    allSpy.mockClear();
    prepareSpy.mockClear();
  });

  it("creates action logs", () => {
    const id = createActionLog({ module: "cleanup", action: "run", details: { done: true }, confirmedByUser: true });
    expect(id).toBe(11);
    expect(runSpy).toHaveBeenCalled();
  });

  it("lists action logs with parsed details", () => {
    allSpy.mockReturnValueOnce([{ id: 1, module: "x", action: "y", severity: "info", details_json: "{\"ok\":true}" }]);
    const rows = listActionLogs({});
    expect(rows[0].details.ok).toBe(true);
  });

  it("persists settings", () => {
    upsertSetting("theme", "dark");
    expect(runSpy).toHaveBeenCalled();
    allSpy.mockReturnValueOnce([{ key: "theme", value: "dark" }]);
    expect(getAllSettings().theme).toBe("dark");
  });
});
