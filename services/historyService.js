const PDFDocument = require("pdfkit");
const { getDb } = require("../database/db");
const { createActionLog, listActionLogs } = require("../database/repositories/actionLogRepository");

function logAction(module, action, details = {}, options = {}) {
  return createActionLog({
    module,
    action,
    details,
    severity: options.severity || "info",
    requiresConfirmation: Boolean(options.requiresConfirmation),
    confirmedByUser: Boolean(options.confirmedByUser)
  });
}

function getHistory(filters = {}) {
  return listActionLogs(filters);
}

function exportCsv(rows) {
  const headers = ["id", "module", "action", "severity", "created_at"];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push([row.id, row.module, row.action, row.severity, row.created_at].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  });
  return lines.join("\n");
}

function exportPdf(rows) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: 42 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.fontSize(18).text("Velance System Care - Maintenance History");
    doc.moveDown();
    rows.slice(0, 80).forEach((row) => {
      doc.fontSize(10).text(`${row.created_at} | ${row.module} | ${row.action} | ${row.severity}`);
    });
    doc.end();
  });
}

function saveSystemSnapshot(snapshot) {
  const db = getDb();
  db.prepare(`
    INSERT INTO system_snapshots(cpu_usage, ram_usage, disk_usage, startup_apps_count, temp_files_bytes, security_status, outdated_apps_count, outdated_drivers_count)
    VALUES (@cpu_usage, @ram_usage, @disk_usage, @startup_apps_count, @temp_files_bytes, @security_status, @outdated_apps_count, @outdated_drivers_count)
  `).run(snapshot);
}

module.exports = {
  logAction,
  getHistory,
  exportCsv,
  exportPdf,
  saveSystemSnapshot
};
