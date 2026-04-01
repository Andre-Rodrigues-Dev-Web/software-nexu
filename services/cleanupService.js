const fs = require("fs");
const path = require("path");
const os = require("os");
const { executePowerShell } = require("./windowsCommandService");

function normalizeTarget(target) {
  return String(target || "").toLowerCase();
}

function buildCleanupCandidates() {
  const userTemp = process.env.TEMP || os.tmpdir();
  const windowsTemp = path.join(process.env.SystemRoot || "C:\\Windows", "Temp");
  return [
    { id: "userTemp", label: "User Temp Folder", path: userTemp, risky: false },
    { id: "windowsTemp", label: "Windows Temp Folder", path: windowsTemp, risky: false },
    { id: "recycleBin", label: "Recycle Bin", path: "$Recycle.Bin", risky: true }
  ];
}

function getFolderSize(folderPath) {
  if (!fs.existsSync(folderPath)) {
    return 0;
  }
  let total = 0;
  const files = fs.readdirSync(folderPath);
  for (const file of files.slice(0, 2500)) {
    const full = path.join(folderPath, file);
    try {
      const stat = fs.statSync(full);
      total += stat.isFile() ? stat.size : 0;
    } catch (_error) {}
  }
  return total;
}

function estimateCleanup(candidates, selectedIds) {
  const selected = selectedIds.map(normalizeTarget);
  return candidates
    .filter((candidate) => selected.includes(normalizeTarget(candidate.id)))
    .map((candidate) => ({
      ...candidate,
      estimatedBytes: candidate.id === "recycleBin" ? 0 : getFolderSize(candidate.path)
    }));
}

async function executeCleanup(items) {
  let freedBytes = 0;
  for (const item of items) {
    if (item.id === "recycleBin") {
      await executePowerShell("Clear-RecycleBin -Force -Confirm:$false");
      continue;
    }
    if (!fs.existsSync(item.path)) {
      continue;
    }
    const files = fs.readdirSync(item.path);
    for (const fileName of files.slice(0, 4000)) {
      const fullPath = path.join(item.path, fileName);
      try {
        const stat = fs.statSync(fullPath);
        const size = stat.isFile() ? stat.size : 0;
        fs.rmSync(fullPath, { recursive: true, force: true });
        freedBytes += size;
      } catch (_error) {}
    }
  }
  return freedBytes;
}

module.exports = {
  buildCleanupCandidates,
  estimateCleanup,
  executeCleanup,
  normalizeTarget
};
