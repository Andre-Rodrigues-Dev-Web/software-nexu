const fs = require("fs");
const path = require("path");
const { getDb } = require("../database/db");

async function measureApiResponseTimes(baseUrl, endpoints) {
  const results = [];
  for (const endpoint of endpoints) {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
      const start = performance.now();
      const response = await fetch(`${baseUrl}${endpoint}`);
      await response.text();
      const duration = performance.now() - start;
      samples.push(Number(duration.toFixed(1)));
    }
    const averageMs = Number((samples.reduce((sum, n) => sum + n, 0) / samples.length).toFixed(1));
    results.push({
      endpoint,
      samples,
      averageMs
    });
  }
  return results;
}

function getMemoryConsumption() {
  const usage = process.memoryUsage();
  return {
    rssMb: Number((usage.rss / (1024 * 1024)).toFixed(1)),
    heapTotalMb: Number((usage.heapTotal / (1024 * 1024)).toFixed(1)),
    heapUsedMb: Number((usage.heapUsed / (1024 * 1024)).toFixed(1)),
    externalMb: Number((usage.external / (1024 * 1024)).toFixed(1))
  };
}

function getBundleSizeAnalysis() {
  const targets = [
    "renderer/js/app.js",
    "renderer/js/softwareModalPolicy.js",
    "renderer/styles/main.css",
    "renderer/styles/main.scss"
  ];
  const items = targets.map((file) => {
    const full = path.join(process.cwd(), file);
    const bytes = fs.existsSync(full) ? fs.statSync(full).size : 0;
    return {
      file,
      bytes,
      kb: Number((bytes / 1024).toFixed(2))
    };
  });
  return {
    items,
    totalKb: Number((items.reduce((sum, item) => sum + item.kb, 0)).toFixed(2))
  };
}

function buildOptimizationSuggestions(report) {
  const suggestions = [];
  const slowApi = report.apiResponseTimes.filter((api) => api.averageMs > 300);
  const highMemory = report.memory.heapUsedMb > 220;
  const largeBundle = report.bundle.totalKb > 650;
  if (slowApi.length) {
    suggestions.push({ priority: "high", message: "Implement cache for frequently requested internal API endpoints." });
  }
  if (highMemory) {
    suggestions.push({ priority: "high", message: "Reduce retained objects and clear long-lived in-memory arrays." });
  }
  if (largeBundle) {
    suggestions.push({ priority: "medium", message: "Split renderer scripts and lazy-load non-critical modules." });
  }
  if (!suggestions.length) {
    suggestions.push({ priority: "low", message: "No major bottlenecks detected. Keep periodic monitoring enabled." });
  }
  return suggestions;
}

function compareWithPrevious(current, previous) {
  if (!previous) {
    return { hasDegradation: false, alerts: [] };
  }
  const alerts = [];
  const currentAvg = current.apiResponseTimes.reduce((sum, item) => sum + item.averageMs, 0) / Math.max(1, current.apiResponseTimes.length);
  const previousAvg = previous.apiResponseTimes.reduce((sum, item) => sum + item.averageMs, 0) / Math.max(1, previous.apiResponseTimes.length);
  if (currentAvg > previousAvg * 1.2) {
    alerts.push("API response time degradation detected (>20%).");
  }
  if (current.memory.heapUsedMb > previous.memory.heapUsedMb * 1.2) {
    alerts.push("Memory consumption degradation detected (>20%).");
  }
  return {
    hasDegradation: alerts.length > 0,
    alerts
  };
}

function persistPerformanceReport(report) {
  const db = getDb();
  db.prepare("INSERT INTO performance_reports(report_json, created_at) VALUES (?, CURRENT_TIMESTAMP)")
    .run(JSON.stringify(report));
}

function listPerformanceReports(limit = 30) {
  const db = getDb();
  const rows = db.prepare("SELECT id, report_json, created_at FROM performance_reports ORDER BY id DESC LIMIT ?").all(limit);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    report: JSON.parse(row.report_json)
  }));
}

function exportPerformanceReportsCsv() {
  const rows = listPerformanceReports(200);
  const header = "id,createdAt,avgApiMs,heapUsedMb,totalBundleKb,alerts";
  const lines = rows.map((row) => {
    const avgApiMs = Number((row.report.apiResponseTimes.reduce((sum, item) => sum + item.averageMs, 0) / Math.max(1, row.report.apiResponseTimes.length)).toFixed(1));
    const heap = row.report.memory.heapUsedMb;
    const bundle = row.report.bundle.totalKb;
    const alerts = (row.report.comparison?.alerts || []).join(" | ").replaceAll('"', '""');
    return `${row.id},"${row.createdAt}",${avgApiMs},${heap},${bundle},"${alerts}"`;
  });
  return [header, ...lines].join("\n");
}

module.exports = {
  measureApiResponseTimes,
  getMemoryConsumption,
  getBundleSizeAnalysis,
  buildOptimizationSuggestions,
  compareWithPrevious,
  persistPerformanceReport,
  listPerformanceReports,
  exportPerformanceReportsCsv
};
