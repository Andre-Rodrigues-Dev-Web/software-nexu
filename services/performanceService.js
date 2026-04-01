const { getRamUsage, estimateDiskUsage, getStartupAppsCount, estimateTempFilesSize, getCpuUsageEstimate } = require("./systemInfoService");
const { executePowerShell } = require("./windowsCommandService");

function classifySeverity(value, warningThreshold, criticalThreshold) {
  if (value >= criticalThreshold) {
    return "critical";
  }
  if (value >= warningThreshold) {
    return "warning";
  }
  return "healthy";
}

async function getHeavyProcesses() {
  const command = "Get-Process | Sort-Object -Property CPU -Descending | Select-Object -First 8 Name,CPU,WorkingSet";
  const result = await executePowerShell(`${command} | ConvertTo-Json`);
  if (!result.ok || !result.output.trim()) {
    return [];
  }
  const parsed = JSON.parse(result.output);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((p) => ({
    name: p.Name,
    cpuSeconds: Number((p.CPU || 0).toFixed ? p.CPU.toFixed(1) : p.CPU || 0),
    memoryMb: Math.round((p.WorkingSet || 0) / (1024 * 1024))
  }));
}

async function analyzePerformance() {
  const [cpuUsage, ram, disk, startupApps, tempFilesBytes, heavyProcesses] = await Promise.all([
    getCpuUsageEstimate(),
    Promise.resolve(getRamUsage()),
    Promise.resolve(estimateDiskUsage()),
    getStartupAppsCount(),
    estimateTempFilesSize(),
    getHeavyProcesses()
  ]);

  const findings = [
    {
      key: "cpu",
      label: "CPU Usage",
      value: cpuUsage,
      severity: classifySeverity(cpuUsage, 70, 90),
      recommendedAction: "Close unnecessary high-CPU applications before deep cleanup."
    },
    {
      key: "ram",
      label: "RAM Usage",
      value: ram.usagePercent,
      severity: classifySeverity(ram.usagePercent, 75, 90),
      recommendedAction: "Disable unneeded startup apps and restart the PC after maintenance."
    },
    {
      key: "diskFree",
      label: "Disk Utilization",
      value: disk.usagePercent,
      severity: classifySeverity(disk.usagePercent, 80, 92),
      recommendedAction: "Run temporary file cleanup and review large app caches."
    },
    {
      key: "startupLoad",
      label: "Startup Apps",
      value: startupApps,
      severity: classifySeverity(startupApps, 16, 24),
      recommendedAction: "Review startup entries and disable non-essential launchers."
    },
    {
      key: "tempFiles",
      label: "Temp Files (MB)",
      value: Math.round(tempFilesBytes / (1024 * 1024)),
      severity: classifySeverity(tempFilesBytes / (1024 * 1024), 900, 1800),
      recommendedAction: "Use granular cleanup with explicit confirmation."
    }
  ];

  return {
    findings,
    heavyProcesses,
    recommendedActions: findings.filter((f) => f.severity !== "healthy").map((f) => f.recommendedAction)
  };
}

module.exports = {
  analyzePerformance,
  classifySeverity,
  getHeavyProcesses
};
