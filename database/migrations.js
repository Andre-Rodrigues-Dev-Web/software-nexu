const schemaSql = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  severity TEXT NOT NULL,
  details_json TEXT NOT NULL,
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  confirmed_by_user INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cpu_usage REAL NOT NULL,
  ram_usage REAL NOT NULL,
  disk_usage REAL NOT NULL,
  startup_apps_count INTEGER NOT NULL,
  temp_files_bytes INTEGER NOT NULL,
  security_status TEXT NOT NULL,
  outdated_apps_count INTEGER NOT NULL,
  outdated_drivers_count INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cleanup_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  estimated_bytes INTEGER NOT NULL,
  freed_bytes INTEGER NOT NULL,
  selected_targets_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scanner_name TEXT NOT NULL,
  defender_status TEXT NOT NULL,
  last_scan_date TEXT,
  suspicious_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detected_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL,
  item_path TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  detection_source TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  approved_action TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(scan_id) REFERENCES security_scans(id)
);

CREATE TABLE IF NOT EXISTS driver_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  devices_json TEXT NOT NULL,
  outdated_count INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS software_update_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  apps_json TEXT NOT NULL,
  outdated_count INTEGER NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  read_flag INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const seedSql = [
  ["INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", "theme", "dark"],
  ["INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", "cleanup.recycleBinEnabled", "false"],
  ["INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", "scan.quickMode", "true"],
  ["INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", "log.retentionDays", "90"],
  ["INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)", "critical.requireAdminConfirmation", "true"]
];

module.exports = {
  schemaSql,
  seedSql
};
