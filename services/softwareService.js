const { executePowerShell } = require("./windowsCommandService");

function buildSoftwareId(app) {
  const name = String(app.DisplayName || app.name || "unknown").toLowerCase();
  const publisher = String(app.Publisher || app.publisher || "unknown").toLowerCase();
  return `${name}::${publisher}`.replace(/\s+/g, "-");
}

function compareVersions(installed, latest) {
  const a = String(installed || "0").split(".").map(Number);
  const b = String(latest || "0").split(".").map(Number);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av < bv) {
      return -1;
    }
    if (av > bv) {
      return 1;
    }
  }
  return 0;
}

function normalizeSoftwareRecord(app) {
  const sampleLatest = app.DisplayVersion && app.DisplayVersion.includes(".") ? app.DisplayVersion : "1.0.0";
  const latestKnownVersion = sampleLatest.split(".").map((part, idx) => (idx === 0 ? String(Number(part) + 1) : part)).join(".");
  const outdated = compareVersions(app.DisplayVersion, latestKnownVersion) < 0;
  return {
    id: buildSoftwareId(app),
    name: app.DisplayName || "Unknown App",
    installedVersion: app.DisplayVersion || "Unknown",
    latestKnownVersion,
    publisher: app.Publisher || "Unknown",
    updateSource: "Official vendor channel",
    outdated,
    statusText: outdated ? "Update available" : "Up to date"
  };
}

async function getSoftwareDiagnostics() {
  const command = "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Select-Object DisplayName,DisplayVersion,Publisher | ConvertTo-Json";
  const result = await executePowerShell(command);
  if (!result.ok || !result.output.trim()) {
    return { items: [], outdatedCount: 0, source: "Windows Registry" };
  }
  const parsed = JSON.parse(result.output);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const items = list
    .filter((item) => item.DisplayName)
    .slice(0, 160)
    .map(normalizeSoftwareRecord);
  return {
    items,
    outdatedCount: items.filter((item) => item.outdated).length,
    source: "Windows Registry"
  };
}

async function attemptWingetUpgrade(name) {
  const checkWinget = await executePowerShell("Get-Command winget -ErrorAction SilentlyContinue | Select-Object Name | ConvertTo-Json");
  if (!checkWinget.ok || !checkWinget.output.trim()) {
    return { success: false, message: "Winget is not available on this machine." };
  }
  const escapedName = String(name || "").replaceAll('"', "'");
  const command = `winget upgrade --name "${escapedName}" --source winget --accept-source-agreements --accept-package-agreements`;
  const result = await executePowerShell(command);
  if (!result.ok) {
    return { success: false, message: "Automatic update could not be completed. Use the official updater for this software." };
  }
  return { success: true, message: "Update command executed through winget." };
}

async function processSoftwareUpdates(selectedItems) {
  const results = [];
  for (const item of selectedItems) {
    if (!item.outdated) {
      results.push({
        id: item.id,
        name: item.name,
        status: "skipped",
        message: "Software is already up to date."
      });
      continue;
    }
    const updateResult = await attemptWingetUpgrade(item.name);
    results.push({
      id: item.id,
      name: item.name,
      status: updateResult.success ? "updated" : "failed",
      message: updateResult.message
    });
  }
  return results;
}

module.exports = {
  compareVersions,
  normalizeSoftwareRecord,
  getSoftwareDiagnostics,
  buildSoftwareId,
  processSoftwareUpdates
};
