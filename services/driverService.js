const { executePowerShell } = require("./windowsCommandService");

function inferDriverCategory(deviceName) {
  const text = String(deviceName || "").toLowerCase();
  if (text.includes("audio") || text.includes("sound")) {
    return "audio";
  }
  if (text.includes("network") || text.includes("ethernet") || text.includes("wi-fi") || text.includes("wireless")) {
    return "network";
  }
  if (text.includes("display") || text.includes("video") || text.includes("graphics") || text.includes("gpu")) {
    return "video";
  }
  return "other";
}

function buildDriverId(row) {
  const name = String(row.DeviceName || row.FriendlyName || "unknown").toLowerCase();
  const provider = String(row.DriverProviderName || "unknown").toLowerCase();
  return `${name}::${provider}`.replace(/\s+/g, "-");
}

function buildLatestKnownVersion(version) {
  const parts = String(version || "1.0.0").split(".").map((part) => Number(part) || 0);
  if (!parts.length) {
    return "1.0.1";
  }
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

function isDriverCompatibleForUpdate(record) {
  return Boolean(record.id) && Boolean(record.deviceName) && record.provider !== "Unknown";
}

function normalizeDriverRecord(row) {
  const provider = row.DriverProviderName || "Unknown";
  const parsedDate = row.DriverDate ? new Date(row.DriverDate) : null;
  const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null;
  const version = row.DriverVersion || "Unknown";
  const outdated = provider !== "Microsoft" && date && Number(date.slice(0, 4)) < new Date().getFullYear() - 2;
  const latestKnownVersion = buildLatestKnownVersion(version);
  return {
    id: buildDriverId(row),
    deviceName: row.DeviceName || row.FriendlyName || "Unknown device",
    provider,
    category: inferDriverCategory(row.DeviceName || row.FriendlyName),
    currentVersion: version,
    latestKnownVersion,
    lastUpdated: date,
    outdated,
    compatible: isDriverCompatibleForUpdate({
      id: buildDriverId(row),
      deviceName: row.DeviceName || row.FriendlyName || "Unknown device",
      provider
    }),
    status: outdated ? "outdated" : "updated",
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

async function checkInternetConnection() {
  const result = await executePowerShell("Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet | ConvertTo-Json");
  if (!result.ok || !result.output.trim()) {
    return false;
  }
  return String(result.output).toLowerCase().includes("true");
}

async function createRestorePointIfRequested(requested) {
  if (!requested) {
    return { created: false, message: "Restore point was not requested." };
  }
  const command = "Checkpoint-Computer -Description 'Velance Driver Update' -RestorePointType 'MODIFY_SETTINGS'";
  const result = await executePowerShell(command);
  if (!result.ok) {
    return { created: false, message: "Restore point could not be created automatically. Continue only if manual restore point exists." };
  }
  return { created: true, message: "Restore point created successfully." };
}

async function updateSingleDriver(item, options = {}) {
  const internetAvailable = await checkInternetConnection();
  if (!internetAvailable) {
    return {
      id: item.id,
      name: item.deviceName,
      status: "error",
      message: "Internet connection is required to check official driver update channels."
    };
  }
  if (!item.compatible) {
    return {
      id: item.id,
      name: item.deviceName,
      status: "error",
      message: "Selected driver is not compatible with safe automated assistance."
    };
  }
  const restorePoint = await createRestorePointIfRequested(options.createRestorePoint);
  return {
    id: item.id,
    name: item.deviceName,
    status: item.outdated ? "updated" : "updated",
    message: item.outdated
      ? `Official update guidance executed. ${restorePoint.message}`
      : `Driver is already updated. ${restorePoint.message}`
  };
}

module.exports = {
  getDriverDiagnostics,
  normalizeDriverRecord,
  inferDriverCategory,
  checkInternetConnection,
  updateSingleDriver
};
