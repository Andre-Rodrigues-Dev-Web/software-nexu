const { executePowerShell } = require("./windowsCommandService");

function classifyRisk(item) {
  const text = `${item.itemPath} ${item.source}`.toLowerCase();
  if (text.includes("trojan") || text.includes("ransom")) {
    return "critical";
  }
  if (text.includes("suspicious") || text.includes("unsigned")) {
    return "high";
  }
  if (text.includes("unknown")) {
    return "medium";
  }
  return "low";
}

async function getDefenderStatus() {
  const command = "Get-MpComputerStatus | Select-Object RealTimeProtectionEnabled,AntivirusEnabled,QuickScanStartTime";
  const result = await executePowerShell(`${command} | ConvertTo-Json`);
  if (!result.ok || !result.output.trim()) {
    return {
      scannerName: "Windows Defender",
      defenderStatus: "unknown",
      lastScanDate: null
    };
  }
  const parsed = JSON.parse(result.output);
  const enabled = Boolean(parsed.AntivirusEnabled) && Boolean(parsed.RealTimeProtectionEnabled);
  return {
    scannerName: "Windows Defender",
    defenderStatus: enabled ? "protected" : "attention",
    lastScanDate: parsed.QuickScanStartTime || null
  };
}

async function inspectRiskyStartupEntries() {
  const command = "Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | ConvertTo-Json";
  const result = await executePowerShell(command);
  if (!result.ok || !result.output.trim()) {
    return [];
  }
  const rows = JSON.parse(result.output);
  const list = Array.isArray(rows) ? rows : [rows];
  return list
    .filter((row) => String(row.Command || "").toLowerCase().includes("appdata"))
    .slice(0, 12)
    .map((row) => ({
      itemPath: row.Command || row.Name,
      source: "Startup Entry",
      recommendedAction: "Review publisher and disable if untrusted."
    }));
}

async function inspectSuspiciousScheduledTasks() {
  const command = "Get-ScheduledTask | Select-Object TaskName,TaskPath,State | ConvertTo-Json";
  const result = await executePowerShell(command);
  if (!result.ok || !result.output.trim()) {
    return [];
  }
  const tasks = JSON.parse(result.output);
  const list = Array.isArray(tasks) ? tasks : [tasks];
  return list
    .filter((task) => String(task.TaskPath || "").toLowerCase().includes("\\users\\"))
    .slice(0, 12)
    .map((task) => ({
      itemPath: `${task.TaskPath}${task.TaskName}`,
      source: "Scheduled Task",
      recommendedAction: "Validate task owner and purpose."
    }));
}

async function runSecurityDiagnostics() {
  const defender = await getDefenderStatus();
  const startup = await inspectRiskyStartupEntries();
  const tasks = await inspectSuspiciousScheduledTasks();
  const items = [...startup, ...tasks].map((item) => ({
    ...item,
    riskLevel: classifyRisk(item)
  }));
  return {
    ...defender,
    suspiciousItems: items,
    status: items.some((item) => item.riskLevel === "critical" || item.riskLevel === "high") ? "attention" : "ok"
  };
}

module.exports = {
  runSecurityDiagnostics,
  classifyRisk,
  getDefenderStatus
};
