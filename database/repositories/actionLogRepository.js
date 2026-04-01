const { getDb } = require("../db");

function createActionLog(entry) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO action_logs(module, action, severity, details_json, requires_confirmation, confirmed_by_user)
    VALUES (@module, @action, @severity, @details_json, @requires_confirmation, @confirmed_by_user)
  `);
  const result = stmt.run({
    module: entry.module,
    action: entry.action,
    severity: entry.severity || "info",
    details_json: JSON.stringify(entry.details || {}),
    requires_confirmation: entry.requiresConfirmation ? 1 : 0,
    confirmed_by_user: entry.confirmedByUser ? 1 : 0
  });
  return result.lastInsertRowid;
}

function listActionLogs(filters = {}) {
  const db = getDb();
  const where = [];
  const params = {};
  if (filters.module) {
    where.push("module = @module");
    params.module = filters.module;
  }
  if (filters.severity) {
    where.push("severity = @severity");
    params.severity = filters.severity;
  }
  if (filters.fromDate) {
    where.push("created_at >= @fromDate");
    params.fromDate = filters.fromDate;
  }
  if (filters.toDate) {
    where.push("created_at <= @toDate");
    params.toDate = filters.toDate;
  }
  const sql = `SELECT * FROM action_logs ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT 500`;
  return db.prepare(sql).all(params).map((row) => ({
    ...row,
    details: JSON.parse(row.details_json)
  }));
}

module.exports = {
  createActionLog,
  listActionLogs
};
