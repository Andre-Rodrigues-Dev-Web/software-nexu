const { getDb } = require("../db");

function getAllSettings() {
  const db = getDb();
  const rows = db.prepare("SELECT key, value, updated_at FROM settings ORDER BY key").all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

function upsertSetting(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings(key, value, updated_at)
    VALUES (@key, @value, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run({ key, value: String(value) });
}

module.exports = {
  getAllSettings,
  upsertSetting
};
