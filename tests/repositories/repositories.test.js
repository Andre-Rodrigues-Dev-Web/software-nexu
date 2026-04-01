const { initializeDatabase, getDb } = require("../../database/db");
const { createActionLog, listActionLogs } = require("../../database/repositories/actionLogRepository");
const { getAllSettings, upsertSetting } = require("../../database/repositories/settingsRepository");

describe("repositories", () => {
  beforeEach(() => {
    initializeDatabase();
    const db = getDb();
    db.exec("DELETE FROM action_logs");
    db.exec("DELETE FROM settings WHERE key LIKE 'test.%'");
  });

  it("creates action logs", () => {
    const id = createActionLog({ module: "cleanup", action: "run", details: { done: true }, confirmedByUser: true });
    expect(Number(id)).toBeGreaterThan(0);
  });

  it("lists action logs with parsed details", () => {
    createActionLog({ module: "x", action: "y", details: { ok: true }, severity: "info" });
    const rows = listActionLogs({});
    expect(rows[0].details.ok).toBe(true);
  });

  it("persists settings", () => {
    upsertSetting("test.theme", "dark");
    expect(getAllSettings()["test.theme"]).toBe("dark");
  });
});
