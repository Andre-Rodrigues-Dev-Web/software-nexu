const { analyzePerformance } = require("../services/performanceService");
const { buildCleanupCandidates, estimateCleanup, executeCleanup } = require("../services/cleanupService");
const { runSecurityDiagnostics } = require("../services/securityService");
const { getDriverDiagnostics } = require("../services/driverService");
const { getSoftwareDiagnostics, processSoftwareUpdates } = require("../services/softwareService");
const { requireConfirmation, ensureArray, ensureObject } = require("../services/validationService");
const { getRamUsage, estimateDiskUsage, estimateTempFilesSize, getStartupAppsCount, getCpuUsageEstimate } = require("../services/systemInfoService");
const { logAction, getHistory, exportCsv, exportPdf, saveSystemSnapshot } = require("../services/historyService");
const { getAllSettings, upsertSetting } = require("../database/repositories/settingsRepository");
const { getDb } = require("../database/db");

function routeGuard(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ error: error.message || "Unexpected error." });
    }
  };
}

function attachRoutes(app) {
  app.get("/api/dashboard/summary", routeGuard(async (_req, res) => {
    const results = await Promise.allSettled([
      getCpuUsageEstimate(),
      Promise.resolve(getRamUsage()),
      Promise.resolve(estimateDiskUsage()),
      getStartupAppsCount(),
      estimateTempFilesSize(),
      runSecurityDiagnostics(),
      getDriverDiagnostics(),
      getSoftwareDiagnostics()
    ]);
    const getValue = (index, fallback) => (results[index].status === "fulfilled" ? results[index].value : fallback);
    const cpuUsage = getValue(0, 0);
    const ram = getValue(1, { usagePercent: 0 });
    const disk = getValue(2, { usagePercent: 0 });
    const startupAppsCount = getValue(3, 0);
    const tempFilesBytes = getValue(4, 0);
    const security = getValue(5, { defenderStatus: "unknown" });
    const drivers = getValue(6, { outdatedCount: 0 });
    const software = getValue(7, { outdatedCount: 0 });
    const snapshot = {
      cpu_usage: cpuUsage,
      ram_usage: ram.usagePercent,
      disk_usage: disk.usagePercent,
      startup_apps_count: startupAppsCount,
      temp_files_bytes: tempFilesBytes,
      security_status: security.defenderStatus,
      outdated_apps_count: software.outdatedCount,
      outdated_drivers_count: drivers.outdatedCount
    };
    saveSystemSnapshot(snapshot);
    logAction("dashboard", "summary_refresh", snapshot, { severity: "info" });
    const db = getDb();
    const lastCleanup = db.prepare("SELECT created_at FROM cleanup_reports WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1").get();
    res.json({
      ...snapshot,
      last_cleanup_date: lastCleanup ? lastCleanup.created_at : null
    });
  }));

  app.get("/api/performance/analyze", routeGuard(async (_req, res) => {
    const report = await analyzePerformance();
    logAction("performance", "analyze", { findings: report.findings.length }, { severity: "info" });
    res.json(report);
  }));

  app.get("/api/cleanup/candidates", routeGuard(async (_req, res) => {
    const candidates = buildCleanupCandidates();
    const estimated = estimateCleanup(candidates, candidates.map((c) => c.id));
    res.json({ candidates, estimatedRecoverableBytes: estimated.reduce((sum, i) => sum + i.estimatedBytes, 0) });
  }));

  app.post("/api/cleanup/preview", routeGuard(async (req, res) => {
    ensureObject(req.body, "body");
    ensureArray(req.body.selectedTargets, "selectedTargets");
    const candidates = buildCleanupCandidates();
    const selected = estimateCleanup(candidates, req.body.selectedTargets);
    res.json({
      items: selected,
      estimatedRecoverableBytes: selected.reduce((sum, i) => sum + i.estimatedBytes, 0)
    });
  }));

  app.post("/api/cleanup/run", routeGuard(async (req, res) => {
    ensureObject(req.body, "body");
    ensureArray(req.body.selectedTargets, "selectedTargets");
    requireConfirmation(req.body, "Cleanup requires explicit confirmation.");
    const candidates = buildCleanupCandidates();
    const selected = estimateCleanup(candidates, req.body.selectedTargets);
    const freedBytes = await executeCleanup(selected);
    const db = getDb();
    db.prepare("INSERT INTO cleanup_reports(estimated_bytes, freed_bytes, selected_targets_json, status) VALUES (?, ?, ?, ?)").run(
      selected.reduce((sum, i) => sum + i.estimatedBytes, 0),
      freedBytes,
      JSON.stringify(selected.map((i) => i.id)),
      "completed"
    );
    logAction("cleanup", "run_cleanup", { selected: selected.map((i) => i.id), freedBytes }, { severity: "warning", requiresConfirmation: true, confirmedByUser: true });
    res.json({ success: true, freedBytes });
  }));

  app.get("/api/security/scan", routeGuard(async (_req, res) => {
    const report = await runSecurityDiagnostics();
    const db = getDb();
    const scanResult = db.prepare("INSERT INTO security_scans(scanner_name, defender_status, last_scan_date, suspicious_count, status) VALUES (?, ?, ?, ?, ?)")
      .run(report.scannerName, report.defenderStatus, report.lastScanDate, report.suspiciousItems.length, report.status);
    const insertItem = db.prepare("INSERT INTO detected_items(scan_id, item_path, risk_level, detection_source, recommended_action) VALUES (?, ?, ?, ?, ?)");
    report.suspiciousItems.forEach((item) => {
      insertItem.run(scanResult.lastInsertRowid, item.itemPath, item.riskLevel, item.source, item.recommendedAction);
    });
    logAction("security", "scan", { suspiciousCount: report.suspiciousItems.length }, { severity: report.status === "ok" ? "info" : "warning" });
    res.json(report);
  }));

  app.get("/api/drivers/check", routeGuard(async (_req, res) => {
    const report = await getDriverDiagnostics();
    getDb().prepare("INSERT INTO driver_reports(devices_json, outdated_count, source) VALUES (?, ?, ?)").run(JSON.stringify(report.items), report.outdatedCount, report.source);
    logAction("drivers", "driver_check", { outdatedCount: report.outdatedCount }, { severity: "info" });
    res.json(report);
  }));

  app.get("/api/software/check", routeGuard(async (_req, res) => {
    const report = await getSoftwareDiagnostics();
    getDb().prepare("INSERT INTO software_update_reports(apps_json, outdated_count, source) VALUES (?, ?, ?)").run(JSON.stringify(report.items), report.outdatedCount, report.source);
    logAction("software", "software_check", { outdatedCount: report.outdatedCount }, { severity: "info" });
    res.json(report);
  }));

  app.post("/api/software/update-selected", routeGuard(async (req, res) => {
    ensureObject(req.body, "body");
    ensureArray(req.body.selectedItems, "selectedItems");
    requireConfirmation(req.body, "Software updates require explicit confirmation.");
    const selectedItems = req.body.selectedItems
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "Unknown App"),
        outdated: Boolean(item.outdated)
      }))
      .filter((item) => item.id);
    const results = await processSoftwareUpdates(selectedItems);
    const successCount = results.filter((item) => item.status === "updated").length;
    const failureCount = results.filter((item) => item.status === "failed").length;
    logAction(
      "software",
      "update_selected",
      { selectedCount: selectedItems.length, successCount, failureCount },
      { severity: failureCount ? "warning" : "info", requiresConfirmation: true, confirmedByUser: true }
    );
    res.json({
      success: true,
      total: selectedItems.length,
      successCount,
      failureCount,
      results
    });
  }));

  app.get("/api/history", routeGuard(async (req, res) => {
    const rows = getHistory(req.query);
    res.json(rows);
  }));

  app.get("/api/history/export/csv", routeGuard(async (req, res) => {
    const rows = getHistory(req.query);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=velance-history.csv");
    res.send(exportCsv(rows));
  }));

  app.get("/api/history/export/pdf", routeGuard(async (req, res) => {
    const rows = getHistory(req.query);
    const buffer = await exportPdf(rows);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=velance-history.pdf");
    res.send(buffer);
  }));

  app.get("/api/settings", routeGuard(async (_req, res) => {
    res.json(getAllSettings());
  }));

  app.post("/api/settings", routeGuard(async (req, res) => {
    ensureObject(req.body, "body");
    const entries = Object.entries(req.body);
    entries.forEach(([key, value]) => upsertSetting(key, value));
    logAction("settings", "update_settings", { keys: entries.map(([key]) => key) }, { severity: "info" });
    res.json({ success: true });
  }));
}

module.exports = {
  attachRoutes,
  routeGuard
};
