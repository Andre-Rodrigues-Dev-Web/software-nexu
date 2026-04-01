const { executePowerShell } = require("./windowsCommandService");

function normalizeDriverRecord(row) {
  const provider = row.DriverProviderName || "Unknown";
  const date = row.DriverDate ? new Date(row.DriverDate).toISOString().slice(0, 10) : null;
  const version = row.DriverVersion || "Unknown";
  const outdated = provider !== "Microsoft" && date && Number(date.slice(0, 4)) < new Date().getFullYear() - 2;
  return {
    deviceName: row.DeviceName || row.FriendlyName || "Unknown device",
    provider,
    version,
    date,
    outdated,
    updatePath: "Use Windows Update or the official manufacturer support page."
  };
}

async function getDriverDiagnostics() {
  const command = "Get-CimInstance Win32_PnPSignedDriver | Select-Object DeviceName,DriverProviderName,DriverVersion,DriverDate | ConvertTo-Json";
  const result = await executePowerShell(command);
  if (!result.ok || !result.output.trim()) {
    return { items: [], outdatedCount: 0, source: "Windows Management Instrumentation" };
  }
  const parsed = JSON.parse(result.output);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const normalized = list.slice(0, 200).map(normalizeDriverRecord);
  const outdatedCount = normalized.filter((i) => i.outdated).length;
  return {
    items: normalized,
    outdatedCount,
    source: "Windows Management Instrumentation",
    restorePointWarning: "Create a restore point before updating critical drivers."
  };
}

module.exports = {
  getDriverDiagnostics,
  normalizeDriverRecord
};
