const os = require("os");
const path = require("path");
const fs = require("fs");
const { executePowerShell } = require("./windowsCommandService");

function toPercent(value) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, bytes);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getRamUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    used,
    free,
    usagePercent: toPercent((used / total) * 100)
  };
}

function estimateDiskUsage() {
  const home = os.homedir();
  try {
    const stat = fs.statfsSync(home);
    const total = stat.blocks * stat.bsize;
    const free = stat.bavail * stat.bsize;
    const used = total - free;
    return {
      total,
      free,
      used,
      usagePercent: toPercent((used / total) * 100)
    };
  } catch (_error) {
    return { total: 0, free: 0, used: 0, usagePercent: 0 };
  }
}

async function getStartupAppsCount() {
  const command = "(Get-CimInstance Win32_StartupCommand | Measure-Object).Count";
  const result = await executePowerShell(command);
  if (!result.ok) {
    return 0;
  }
  return Number(result.output.trim()) || 0;
}

async function getCpuUsageEstimate() {
  const command = "(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples.CookedValue";
  const result = await executePowerShell(command);
  if (!result.ok) {
    return 0;
  }
  return toPercent(Number(result.output.trim()) || 0);
}

function getTempDirectories() {
  const userTemp = process.env.TEMP || os.tmpdir();
  const windowsTemp = path.join(process.env.SystemRoot || "C:\\Windows", "Temp");
  return [userTemp, windowsTemp];
}

async function estimateTempFilesSize() {
  const dirs = getTempDirectories();
  let total = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch (_error) {
      continue;
    }
    for (const name of entries.slice(0, 1500)) {
      const fullPath = path.join(dir, name);
      try {
        const stat = fs.statSync(fullPath);
        total += stat.isFile() ? stat.size : 0;
      } catch (_error) {}
    }
  }
  return total;
}

module.exports = {
  formatBytes,
  toPercent,
  getRamUsage,
  estimateDiskUsage,
  getStartupAppsCount,
  getCpuUsageEstimate,
  estimateTempFilesSize,
  getTempDirectories
};
