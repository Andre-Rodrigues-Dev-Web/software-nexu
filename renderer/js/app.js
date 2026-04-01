const API = window.velance.getApiBaseUrl();
const chartPoints = [];
const softwareState = {
  items: [],
  selectedIds: new Set(),
  searchText: "",
  statusFilter: "all",
  sortBy: "name-asc",
  updating: false
};

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2400);
}

async function apiGet(path) {
  const response = await fetch(`${API}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${path}`);
  }
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${path}`);
  }
  return response.json();
}

function setPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("is-active"));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("is-active"));
  document.getElementById(pageId).classList.add("is-active");
  document.querySelector(`[data-page="${pageId}"]`).classList.add("is-active");
  document.getElementById("pageTitle").textContent = document.querySelector(`[data-page="${pageId}"]`).textContent;
}

function renderCards(summary) {
  const cards = [
    ["CPU usage", `${summary.cpu_usage}%`],
    ["RAM usage", `${summary.ram_usage}%`],
    ["Disk usage", `${summary.disk_usage}%`],
    ["Startup apps", String(summary.startup_apps_count)],
    ["Temp files size", `${Math.round(summary.temp_files_bytes / (1024 * 1024))} MB`],
    ["Last cleanup", summary.last_cleanup_date || "Never"],
    ["Security status", summary.security_status],
    ["Outdated apps", String(summary.outdated_apps_count)],
    ["Outdated drivers", String(summary.outdated_drivers_count)]
  ];
  document.getElementById("summaryCards").innerHTML = cards
    .map(([label, value]) => `<article class="card"><p>${label}</p><h3>${value}</h3></article>`)
    .join("");
  document.getElementById("securityBadge").textContent = `Security: ${summary.security_status}`;
}

function drawChart(summary) {
  chartPoints.push({ cpu: summary.cpu_usage, ram: summary.ram_usage, disk: summary.disk_usage });
  while (chartPoints.length > 24) {
    chartPoints.shift();
  }
  const canvas = document.getElementById("usageChart");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const drawLine = (key, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    chartPoints.forEach((point, index) => {
      const x = (index / Math.max(1, chartPoints.length - 1)) * (canvas.width - 40) + 20;
      const y = canvas.height - (point[key] / 100) * (canvas.height - 40) - 20;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawLine("cpu", "#38bdf8");
  drawLine("ram", "#34d399");
  drawLine("disk", "#f59e0b");
}

async function loadDashboard() {
  const summary = await apiGet("/dashboard/summary");
  renderCards(summary);
  drawChart(summary);
}

function renderTable(containerId, headers, rows) {
  const head = headers.map((h) => `<th>${h}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  document.getElementById(containerId).innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function loadPerformance() {
  const report = await apiGet("/performance/analyze");
  const findings = report.findings.map((f) => `<li>${f.label}: ${f.value} (${f.severity}) — ${f.recommendedAction}</li>`).join("");
  const actions = report.recommendedActions.map((r) => `<li>${r}</li>`).join("");
  document.getElementById("performanceReport").innerHTML = `
    <h4>Findings</h4><ul>${findings}</ul>
    <h4>Recommended actions</h4><ul>${actions || "<li>No immediate action required.</li>"}</ul>
  `;
}

async function loadSecurity() {
  const report = await apiGet("/security/scan");
  const rows = report.suspiciousItems.map((i) => [i.itemPath, i.riskLevel, i.source, i.recommendedAction]);
  renderTable("securityReport", ["Path", "Risk", "Source", "Recommended action"], rows);
}

async function loadDrivers() {
  const report = await apiGet("/drivers/check");
  const rows = report.items.slice(0, 80).map((i) => [i.deviceName, i.version, i.provider, i.date || "-", i.outdated ? "Yes" : "No"]);
  renderTable("driverReport", ["Device", "Version", "Provider", "Date", "Outdated"], rows);
}

async function loadSoftware() {
  const report = await apiGet("/software/check");
  softwareState.items = report.items || [];
  const availableIds = new Set(softwareState.items.map((item) => item.id));
  softwareState.selectedIds = new Set(Array.from(softwareState.selectedIds).filter((id) => availableIds.has(id)));
  renderSoftwareTable();
}

function getFilteredAndSortedSoftwareItems() {
  const text = softwareState.searchText.trim().toLowerCase();
  const filtered = softwareState.items.filter((item) => {
    const matchesText = !text || item.name.toLowerCase().includes(text) || String(item.publisher || "").toLowerCase().includes(text);
    const matchesStatus = softwareState.statusFilter === "all"
      || (softwareState.statusFilter === "outdated" && item.outdated)
      || (softwareState.statusFilter === "updated" && !item.outdated);
    return matchesText && matchesStatus;
  });
  if (softwareState.sortBy === "name-asc") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (softwareState.sortBy === "name-desc") {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  } else {
    filtered.sort((a, b) => Number(b.outdated) - Number(a.outdated) || a.name.localeCompare(b.name));
  }
  return filtered;
}

function updateSoftwareActionButton() {
  const selectedCount = softwareState.selectedIds.size;
  const button = document.getElementById("updateSoftwareBtn");
  button.disabled = selectedCount === 0 || softwareState.updating;
  button.textContent = selectedCount > 0 ? `Atualizar Software (${selectedCount})` : "Atualizar Software";
}

function renderSoftwareTable() {
  const rows = getFilteredAndSortedSoftwareItems();
  const body = rows.map((item) => {
    const checked = softwareState.selectedIds.has(item.id) ? "checked" : "";
    const statusClass = item.outdated ? "status-pill--outdated" : "status-pill--updated";
    const statusText = item.outdated ? "Atualização disponível" : "Atualizado";
    return `
      <tr>
        <td><input type="checkbox" class="software-select" value="${escapeHtml(item.id)}" ${checked} aria-label="Selecionar ${escapeHtml(item.name)}" /></td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.installedVersion)}</td>
        <td>${escapeHtml(item.latestKnownVersion)}</td>
        <td>${escapeHtml(item.publisher)}</td>
        <td><span class="status-pill ${statusClass}">${statusText}</span></td>
      </tr>
    `;
  }).join("");
  const table = `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Software</th>
          <th>Installed</th>
          <th>Latest</th>
          <th>Publisher</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${body || "<tr><td colspan='6'>No software found.</td></tr>"}</tbody>
    </table>
  `;
  document.getElementById("softwareReport").innerHTML = table;
  updateSoftwareActionButton();
}

function setSoftwareProgress(percent, label) {
  const wrap = document.getElementById("softwareProgressWrap");
  const fill = document.getElementById("softwareProgressFill");
  const bar = wrap.querySelector(".progress-bar");
  const labelNode = document.getElementById("softwareProgressLabel");
  wrap.classList.remove("hidden");
  fill.style.width = `${percent}%`;
  bar.setAttribute("aria-valuenow", String(percent));
  labelNode.textContent = label;
}

function hideSoftwareProgress() {
  document.getElementById("softwareProgressWrap").classList.add("hidden");
}

function openSoftwareModal(count) {
  document.getElementById("softwareModalText").textContent = `Você selecionou ${count} software(s). Deseja iniciar a atualização agora?`;
  document.getElementById("softwareConfirmModal").classList.remove("hidden");
}

function closeSoftwareModal() {
  document.getElementById("softwareConfirmModal").classList.add("hidden");
}

async function runSoftwareUpdates() {
  const selectedItems = softwareState.items.filter((item) => softwareState.selectedIds.has(item.id));
  if (!selectedItems.length) {
    toast("Selecione ao menos um software.");
    return;
  }
  softwareState.updating = true;
  updateSoftwareActionButton();
  closeSoftwareModal();
  let successCount = 0;
  let failureCount = 0;
  for (let i = 0; i < selectedItems.length; i += 1) {
    const item = selectedItems[i];
    setSoftwareProgress(Math.round((i / selectedItems.length) * 100), `Atualizando ${item.name}...`);
    try {
      const response = await apiPost("/software/update-selected", {
        selectedItems: [item],
        confirmed: true
      });
      const result = response.results[0];
      if (result && result.status === "updated") {
        successCount += 1;
        const index = softwareState.items.findIndex((software) => software.id === item.id);
        if (index >= 0) {
          softwareState.items[index].outdated = false;
          softwareState.items[index].statusText = "Up to date";
        }
      } else if (result && result.status === "failed") {
        failureCount += 1;
      }
    } catch (_error) {
      failureCount += 1;
    }
  }
  setSoftwareProgress(100, "Atualização finalizada.");
  softwareState.updating = false;
  renderSoftwareTable();
  setTimeout(hideSoftwareProgress, 900);
  toast(failureCount ? `Atualização concluída com falhas. Sucesso: ${successCount}, falhas: ${failureCount}` : `Atualização concluída com sucesso. Total: ${successCount}`);
}

async function loadCleanupTargets() {
  const result = await apiGet("/cleanup/candidates");
  document.getElementById("cleanupForm").innerHTML = result.candidates
    .map((item) => `<label><input type="checkbox" name="cleanupTarget" value="${item.id}" /> ${item.label}</label><br />`)
    .join("");
  toast(`Estimated recoverable space: ${Math.round(result.estimatedRecoverableBytes / (1024 * 1024))} MB`);
}

function getSelectedCleanupTargets() {
  return Array.from(document.querySelectorAll('input[name="cleanupTarget"]:checked')).map((input) => input.value);
}

async function previewCleanup() {
  const selectedTargets = getSelectedCleanupTargets();
  const preview = await apiPost("/cleanup/preview", { selectedTargets });
  const lines = preview.items.map((item) => `<li>${item.label}: ${Math.round(item.estimatedBytes / (1024 * 1024))} MB</li>`).join("");
  document.getElementById("cleanupReport").innerHTML = `<h4>Preview</h4><ul>${lines}</ul>`;
}

async function runCleanup() {
  const selectedTargets = getSelectedCleanupTargets();
  if (!selectedTargets.length) {
    toast("Select at least one cleanup target.");
    return;
  }
  if (!window.confirm("Confirm cleanup operation? Selected targets will be removed safely.")) {
    return;
  }
  const result = await apiPost("/cleanup/run", { selectedTargets, confirmed: true });
  document.getElementById("cleanupReport").innerHTML = `<p>Cleanup completed. Freed ${Math.round(result.freedBytes / (1024 * 1024))} MB.</p>`;
  toast("Cleanup completed.");
}

async function loadHistory() {
  const module = document.getElementById("historyModule").value;
  const fromDate = document.getElementById("historyFromDate").value;
  const params = new URLSearchParams();
  if (module) params.set("module", module);
  if (fromDate) params.set("fromDate", fromDate);
  const rows = await apiGet(`/history?${params.toString()}`);
  renderTable("historyTable", ["Date", "Module", "Action", "Severity"], rows.map((r) => [r.created_at, r.module, r.action, r.severity]));
}

function wireEvents() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => setPage(button.dataset.page));
  });
  document.getElementById("analyzeBtn").addEventListener("click", () => setPage("performance"));
  document.getElementById("quickCleanupBtn").addEventListener("click", () => setPage("cleanup"));
  document.getElementById("checkSecurityBtn").addEventListener("click", () => setPage("security"));
  document.getElementById("checkSoftwareBtn").addEventListener("click", () => setPage("software"));
  document.getElementById("checkDriversBtn").addEventListener("click", () => setPage("drivers"));
  document.getElementById("runPerformanceScanBtn").addEventListener("click", () => loadPerformance().catch((e) => toast(e.message)));
  document.getElementById("runSecurityScanBtn").addEventListener("click", () => loadSecurity().catch((e) => toast(e.message)));
  document.getElementById("runDriverCheckBtn").addEventListener("click", () => loadDrivers().catch((e) => toast(e.message)));
  document.getElementById("runSoftwareCheckBtn").addEventListener("click", () => loadSoftware().catch((e) => toast(e.message)));
  document.getElementById("softwareSearchInput").addEventListener("input", (event) => {
    softwareState.searchText = event.target.value;
    renderSoftwareTable();
  });
  document.getElementById("softwareStatusFilter").addEventListener("change", (event) => {
    softwareState.statusFilter = event.target.value;
    renderSoftwareTable();
  });
  document.getElementById("softwareSortSelect").addEventListener("change", (event) => {
    softwareState.sortBy = event.target.value;
    renderSoftwareTable();
  });
  document.getElementById("softwareReport").addEventListener("change", (event) => {
    if (!event.target.classList.contains("software-select")) {
      return;
    }
    const softwareId = event.target.value;
    if (event.target.checked) {
      softwareState.selectedIds.add(softwareId);
    } else {
      softwareState.selectedIds.delete(softwareId);
    }
    updateSoftwareActionButton();
  });
  document.getElementById("selectVisibleSoftwareBtn").addEventListener("click", () => {
    getFilteredAndSortedSoftwareItems().forEach((item) => softwareState.selectedIds.add(item.id));
    renderSoftwareTable();
  });
  document.getElementById("clearSoftwareSelectionBtn").addEventListener("click", () => {
    softwareState.selectedIds.clear();
    renderSoftwareTable();
  });
  document.getElementById("updateSoftwareBtn").addEventListener("click", () => {
    if (!softwareState.selectedIds.size) {
      toast("Selecione ao menos um software.");
      return;
    }
    openSoftwareModal(softwareState.selectedIds.size);
  });
  document.getElementById("cancelSoftwareUpdateBtn").addEventListener("click", closeSoftwareModal);
  document.getElementById("confirmSoftwareUpdateBtn").addEventListener("click", () => runSoftwareUpdates().catch((e) => toast(e.message)));
  document.getElementById("loadCleanupTargetsBtn").addEventListener("click", () => loadCleanupTargets().catch((e) => toast(e.message)));
  document.getElementById("previewCleanupBtn").addEventListener("click", () => previewCleanup().catch((e) => toast(e.message)));
  document.getElementById("runCleanupBtn").addEventListener("click", () => runCleanup().catch((e) => toast(e.message)));
  document.getElementById("loadHistoryBtn").addEventListener("click", () => loadHistory().catch((e) => toast(e.message)));
  document.getElementById("exportCsvBtn").addEventListener("click", () => window.open(`${API}/history/export/csv`, "_blank"));
  document.getElementById("exportPdfBtn").addEventListener("click", () => window.open(`${API}/history/export/pdf`, "_blank"));
  document.getElementById("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {};
    form.forEach((value, key) => {
      payload[key] = value;
    });
    await apiPost("/settings", payload);
    toast("Settings saved.");
  });
}

async function bootstrap() {
  wireEvents();
  await loadDashboard();
  setInterval(() => loadDashboard().catch(() => null), 15000);
  document.getElementById("splash").classList.add("hide");
  toast("Velance System Care ready.");
}

bootstrap().catch((error) => {
  toast(error.message);
});
