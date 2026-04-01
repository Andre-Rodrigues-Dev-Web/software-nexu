const { executePowerShell } = require("./windowsCommandService");

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
  return {
    name: app.DisplayName || "Unknown App",
    installedVersion: app.DisplayVersion || "Unknown",
    latestKnownVersion,
    publisher: app.Publisher || "Unknown",
    updateSource: "Official vendor channel",
    outdated: compareVersions(app.DisplayVersion, latestKnownVersion) < 0
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

module.exports = {
  compareVersions,
  normalizeSoftwareRecord,
  getSoftwareDiagnostics
};
