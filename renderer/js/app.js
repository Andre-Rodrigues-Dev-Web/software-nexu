const API = window.velance.getApiBaseUrl();
const chartPoints = [];
const softwareState = {
  items: [],
  selectedIds: new Set(),
  searchText: "",
  statusFilter: "all",
  sortBy: "name-asc",
  updating: false,
  autoPromptEnabled: false,
  autoPromptShown: false
};
const driverState = {
  items: [],
  selectedIds: new Set(),
  filterCategory: "all",
  createRestorePoint: false,
  updating: false,
  cancelRequested: false,
  updateQueue: [],
  language: "pt-BR"
};
const performanceState = {
  realtimePoints: [],
  latestReport: null,
  alerts: [],
  monitoringInterval: null
};
const i18n = {
  "pt-BR": {
    driverUpdated: "Atualizado",
    driverOutdated: "Desatualizado",
    driverPending: "Pendente",
    driverError: "Erro",
    noDrivers: "Nenhum driver encontrado.",
    confirmSelected: "Deseja atualizar os drivers selecionados?",
    confirmAll: "Deseja atualizar todos os drivers compatíveis?",
    noSelection: "Selecione ao menos um driver.",
    internetRequired: "Sem internet. Não é possível atualizar agora.",
    updateCompleted: "Atualização de drivers concluída.",
    updateCancelled: "Atualização cancelada pelo usuário.",
    restorePointTip: "Criar ponto de restauração antes da atualização."
  },
  "en-US": {
    driverUpdated: "Updated",
    driverOutdated: "Outdated",
    driverPending: "Pending",
    driverError: "Error",
    noDrivers: "No drivers found.",
    confirmSelected: "Do you want to update selected drivers?",
    confirmAll: "Do you want to update all compatible drivers?",
    noSelection: "Select at least one driver.",
    internetRequired: "No internet connection. Update is unavailable.",
    updateCompleted: "Driver update completed.",
    updateCancelled: "Update cancelled by user.",
    restorePointTip: "Create a restore point before update."
  }
};

function t(key) {
  const dict = i18n[driverState.language] || i18n["pt-BR"];
  return dict[key] || key;
}

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2400);
}

function initializeIcons() {
  if (window.feather && typeof window.feather.replace === "function") {
    window.feather.replace({ width: 16, height: 16, strokeWidth: 2 });
  }
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

function drawRealtimePerformanceChart() {
  const canvas = document.getElementById("performanceRealtimeChart");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const points = performanceState.realtimePoints;
  const drawLine = (key, color, maxValue) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    points.forEach((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * (canvas.width - 40) + 20;
      const y = canvas.height - (Math.min(point[key], maxValue) / maxValue) * (canvas.height - 40) - 20;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
  drawLine("avgApiMs", "#38bdf8", 1500);
  drawLine("heapUsedMb", "#34d399", 600);
  drawLine("bundleKb", "#f59e0b", 2000);
}

function renderPerformanceAlerts(alerts) {
  const container = document.getElementById("performanceAlerts");
  const items = alerts.length
    ? alerts.map((a) => `<div class="alert-item alert-item--warning">${escapeHtml(a)}</div>`).join("")
    : `<div class="alert-item">Nenhum alerta de degradação.</div>`;
  container.innerHTML = `<div class="alert-list">${items}</div>`;
}

function renderPerformanceHistory(items) {
  const container = document.getElementById("performanceHistory");
  if (!items.length) {
    container.innerHTML = `<p>Sem histórico ainda.</p>`;
    return;
  }
  const rows = items.slice(0, 12).map((item) => {
    const avgApiMs = item.report.apiResponseTimes.reduce((sum, v) => sum + v.averageMs, 0) / Math.max(1, item.report.apiResponseTimes.length);
    const heap = item.report.memory.heapUsedMb;
    const bundle = item.report.bundle.totalKb;
    const alertCount = (item.report.comparison?.alerts || []).length;
    return [item.createdAt, avgApiMs.toFixed(1), String(heap), String(bundle), String(alertCount)];
  });
  renderTable("performanceHistory", ["Data", "Avg API (ms)", "Heap (MB)", "Bundle (KB)", "Alertas"], rows);
}

async function loadPerformanceHistory() {
  const payload = await apiGet("/performance/history");
  renderPerformanceHistory(payload.items || []);
}

async function collectRendererProfiling() {
  const navigationMs = performance.getEntriesByType("navigation")[0]?.duration || 0;
  const memory = performance.memory ? {
    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    totalJSHeapSize: performance.memory.totalJSHeapSize,
    usedJSHeapSize: performance.memory.usedJSHeapSize
  } : null;
  return {
    navigationMs: Number(navigationMs.toFixed(1)),
    memory
  };
}

async function runFullPerformanceReport() {
  const renderer = await collectRendererProfiling();
  const report = await apiPost("/performance/full-report", { renderer });
  performanceState.latestReport = report;
  performanceState.alerts = report.comparison?.alerts || [];
  renderPerformanceAlerts(performanceState.alerts);
  const suggestions = report.suggestions.map((s) => `<li>${escapeHtml(s.priority)} — ${escapeHtml(s.message)}</li>`).join("");
  const apiRows = report.apiResponseTimes.map((r) => `<li>${escapeHtml(r.endpoint)}: avg ${r.averageMs}ms (samples: ${r.samples.join(", ")})</li>`).join("");
  document.getElementById("performanceReport").innerHTML = `
    <div class="perf-grid">
      <div class="panel">
        <h4>Tempo de resposta de APIs</h4>
        <ul>${apiRows}</ul>
      </div>
      <div class="panel">
        <h4>Memória</h4>
        <p>Heap used: ${report.memory.heapUsedMb} MB | RSS: ${report.memory.rssMb} MB</p>
      </div>
      <div class="panel">
        <h4>Bundle size</h4>
        <p>Total: ${report.bundle.totalKb} KB</p>
      </div>
      <div class="panel">
        <h4>Sugestões priorizadas</h4>
        <ul>${suggestions}</ul>
      </div>
      <div class="panel">
        <h4>Profiling nativo</h4>
        <p>Abra DevTools e use Performance/Memory para profiling detalhado.</p>
      </div>
    </div>
  `;
  const avgApiMs = report.apiResponseTimes.reduce((sum, item) => sum + item.averageMs, 0) / Math.max(1, report.apiResponseTimes.length);
  performanceState.realtimePoints.push({
    avgApiMs: Number(avgApiMs.toFixed(1)),
    heapUsedMb: report.memory.heapUsedMb,
    bundleKb: report.bundle.totalKb
  });
  while (performanceState.realtimePoints.length > 30) {
    performanceState.realtimePoints.shift();
  }
  drawRealtimePerformanceChart();
}

async function runApiResponseAnalysis() {
  const result = await apiGet("/performance/api-response");
  const list = result.apiResponseTimes.map((r) => `<li>${escapeHtml(r.endpoint)}: ${r.averageMs}ms</li>`).join("");
  document.getElementById("performanceReport").innerHTML = `<h4>Tempo de resposta APIs</h4><ul>${list}</ul>`;
}

async function runMemoryMonitor() {
  const result = await apiGet("/performance/memory");
  document.getElementById("performanceReport").innerHTML = `
    <h4>Consumo de memória</h4>
    <p>RSS: ${result.memory.rssMb} MB</p>
    <p>Heap used: ${result.memory.heapUsedMb} MB</p>
  `;
}

async function runBundleSizeAnalysis() {
  const result = await apiGet("/performance/bundle");
  const rows = result.bundle.items.map((i) => [i.file, String(i.kb)]);
  renderTable("performanceReport", ["Arquivo", "KB"], rows);
}

async function runPageLoadAnalysis() {
  const renderer = await collectRendererProfiling();
  document.getElementById("performanceReport").innerHTML = `
    <h4>Tempo de carregamento</h4>
    <p>Navegação (renderer): ${renderer.navigationMs} ms</p>
  `;
}

function runRenderBottleneckAnalysis() {
  document.getElementById("performanceReport").innerHTML = `
    <h4>Gargalos de renderização</h4>
    <p>Abra DevTools e use Performance para gravar um profile de renderização do renderer.</p>
  `;
}

function runSlowComponentsAnalysis() {
  document.getElementById("performanceReport").innerHTML = `
    <h4>Componentes com renderização lenta</h4>
    <p>O renderer usa Vanilla JS. Use DevTools Performance + "Timings" para localizar funções lentas e eventos de layout/reflow.</p>
  `;
}

function openNativeProfiler() {
  try {
    if (window && window.require) {
      document.getElementById("performanceReport").innerHTML = `<p>Profiling nativo disponível via DevTools: Performance/Memory.</p>`;
      return;
    }
  } catch (_e) {}
  document.getElementById("performanceReport").innerHTML = `<p>Abra o DevTools do Electron (View -> Toggle Developer Tools) e use as abas Performance/Memory.</p>`;
}

function exportPerformanceLogs() {
  window.open(`${API}/performance/export/csv`, "_blank");
}

async function runAutoPerformanceAlertCheck() {
  if (!document.getElementById("performance").classList.contains("is-active")) {
    return;
  }
  await runFullPerformanceReport();
  if (performanceState.alerts.length) {
    toast(`Alertas de performance: ${performanceState.alerts.length}`);
  }
}

async function loadSecurity() {
  const report = await apiGet("/security/scan");
  const rows = report.suspiciousItems.map((i) => [i.itemPath, i.riskLevel, i.source, i.recommendedAction]);
  renderTable("securityReport", ["Path", "Risk", "Source", "Recommended action"], rows);
}

async function loadDrivers() {
  const report = await apiGet("/drivers/check");
  driverState.items = report.items || [];
  const existingIds = new Set(driverState.items.map((item) => item.id));
  driverState.selectedIds = new Set(Array.from(driverState.selectedIds).filter((id) => existingIds.has(id)));
  renderDriverTable();
}

function getDriverStatusPill(driver) {
  if (driver.status === "error") {
    return `<span class="status-pill status-pill--error">${t("driverError")}</span>`;
  }
  if (driver.status === "pending") {
    return `<span class="status-pill status-pill--pending">${t("driverPending")}</span>`;
  }
  if (driver.outdated) {
    return `<span class="status-pill status-pill--outdated">${t("driverOutdated")}</span>`;
  }
  return `<span class="status-pill status-pill--updated">${t("driverUpdated")}</span>`;
}

function getFilteredDrivers() {
  return driverState.items.filter((item) => driverState.filterCategory === "all" || item.category === driverState.filterCategory);
}

function updateDriverActionButtons() {
  document.getElementById("updateSelectedDriversBtn").disabled = driverState.updating || driverState.selectedIds.size === 0;
  document.getElementById("cancelDriverUpdateBtn").disabled = !driverState.updating;
  document.getElementById("driverSelectAll").checked = !!driverState.items.length && driverState.selectedIds.size === driverState.items.length;
}

function renderDriverTable() {
  const rows = getFilteredDrivers();
  const body = rows.map((driver) => {
    const checked = driverState.selectedIds.has(driver.id) ? "checked" : "";
    return `
      <tr>
        <td><input type="checkbox" class="driver-select" value="${escapeHtml(driver.id)}" ${checked} aria-label="Selecionar ${escapeHtml(driver.deviceName)}" /></td>
        <td>${escapeHtml(driver.deviceName)}</td>
        <td>${escapeHtml(driver.category)}</td>
        <td>${escapeHtml(driver.currentVersion)}</td>
        <td>${escapeHtml(driver.latestKnownVersion)}</td>
        <td>${escapeHtml(driver.provider)}</td>
        <td>${escapeHtml(driver.lastUpdated || "-")}</td>
        <td>${getDriverStatusPill(driver)}</td>
      </tr>
    `;
  }).join("");
  document.getElementById("driverReport").innerHTML = `
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Dispositivo</th>
          <th>Categoria</th>
          <th>Versão Atual</th>
          <th>Nova Versão</th>
          <th>Fornecedor</th>
          <th>Última Atualização</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${body || `<tr><td colspan="8">${t("noDrivers")}</td></tr>`}</tbody>
    </table>
  `;
  updateDriverActionButtons();
}

function appendDriverLog(message) {
  const logNode = document.getElementById("driverUpdateLogs");
  const timestamp = new Date().toLocaleTimeString();
  logNode.textContent += `[${timestamp}] ${message}\n`;
  logNode.scrollTop = logNode.scrollHeight;
}

function setDriverProgress(percent, label) {
  const wrap = document.getElementById("driverProgressWrap");
  const fill = document.getElementById("driverProgressFill");
  const bar = wrap.querySelector(".progress-bar");
  document.getElementById("driverProgressLabel").textContent = label;
  wrap.classList.remove("hidden");
  fill.style.width = `${percent}%`;
  bar.setAttribute("aria-valuenow", String(percent));
}

function hideDriverProgress() {
  document.getElementById("driverProgressWrap").classList.add("hidden");
}

function openDriverConfirmModal(mode) {
  const text = mode === "all" ? t("confirmAll") : t("confirmSelected");
  document.getElementById("driverModalText").textContent = `${text} ${t("restorePointTip")}`;
  document.getElementById("driverConfirmModal").dataset.mode = mode;
  document.getElementById("driverConfirmModal").classList.remove("hidden");
}

function closeDriverConfirmModal() {
  document.getElementById("driverConfirmModal").classList.add("hidden");
}

async function checkDriverInternetAvailability() {
  const result = await apiGet("/drivers/internet-status");
  return Boolean(result.connected);
}

async function runDriverUpdates(mode) {
  const internet = await checkDriverInternetAvailability();
  if (!internet) {
    toast(t("internetRequired"));
    appendDriverLog(t("internetRequired"));
    return;
  }
  const targets = mode === "all"
    ? driverState.items.filter((item) => item.compatible)
    : driverState.items.filter((item) => driverState.selectedIds.has(item.id));
  if (!targets.length) {
    toast(t("noSelection"));
    return;
  }
  closeDriverConfirmModal();
  driverState.updating = true;
  driverState.cancelRequested = false;
  driverState.updateQueue = targets.map((item) => item.id);
  updateDriverActionButtons();
  appendDriverLog(`Iniciando atualização de ${targets.length} driver(s).`);
  let processed = 0;
  for (const item of targets) {
    if (driverState.cancelRequested) {
      appendDriverLog(t("updateCancelled"));
      break;
    }
    const index = driverState.items.findIndex((driver) => driver.id === item.id);
    if (index >= 0) {
      driverState.items[index].status = "pending";
      renderDriverTable();
    }
    setDriverProgress(Math.round((processed / targets.length) * 100), `Atualizando ${item.deviceName}...`);
    try {
      const response = await apiPost("/drivers/update-item", {
        item,
        createRestorePoint: driverState.createRestorePoint,
        confirmed: true
      });
      const status = response.result?.status === "error" ? "error" : "updated";
      if (index >= 0) {
        driverState.items[index].status = status;
        driverState.items[index].outdated = status !== "updated" ? driverState.items[index].outdated : false;
      }
      appendDriverLog(response.result?.message || `Driver ${item.deviceName} processado.`);
    } catch (error) {
      if (index >= 0) {
        driverState.items[index].status = "error";
      }
      appendDriverLog(`Falha ao atualizar ${item.deviceName}: ${error.message}`);
    }
    processed += 1;
    setDriverProgress(Math.round((processed / targets.length) * 100), `Processados ${processed}/${targets.length} drivers.`);
    renderDriverTable();
  }
  driverState.updating = false;
  driverState.updateQueue = [];
  updateDriverActionButtons();
  setTimeout(hideDriverProgress, 1200);
  toast(t("updateCompleted"));
}

async function loadSoftware() {
  const report = await apiGet("/software/check");
  softwareState.items = report.items || [];
  const availableIds = new Set(softwareState.items.map((item) => item.id));
  softwareState.selectedIds = new Set(Array.from(softwareState.selectedIds).filter((id) => availableIds.has(id)));
  renderSoftwareTable();
  maybeAutoOpenSoftwareModal();
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

function countPendingSoftwareUpdates() {
  return softwareState.items.filter((item) => item.outdated).length;
}

function requestSoftwareModal(trigger) {
  const policy = window.softwareModalPolicy || { shouldOpenSoftwareModal: () => false };
  const shouldOpen = policy.shouldOpenSoftwareModal({
    trigger,
    selectedCount: softwareState.selectedIds.size,
    pendingCount: countPendingSoftwareUpdates(),
    preferenceEnabled: softwareState.autoPromptEnabled,
    alreadyShown: softwareState.autoPromptShown,
    updating: softwareState.updating
  });
  if (!shouldOpen) {
    return false;
  }
  if (trigger === "auto") {
    softwareState.items
      .filter((item) => item.outdated)
      .forEach((item) => softwareState.selectedIds.add(item.id));
    softwareState.autoPromptShown = true;
    renderSoftwareTable();
  }
  openSoftwareModal(softwareState.selectedIds.size);
  return true;
}

function maybeAutoOpenSoftwareModal() {
  requestSoftwareModal("auto");
}

async function loadSettings() {
  const settings = await apiGet("/settings");
  softwareState.autoPromptEnabled = settings["software.autoPromptUpdates"] === "true";
  driverState.filterCategory = settings["driver.filterCategory"] || "all";
  driverState.createRestorePoint = settings["driver.createRestorePoint"] === "true";
  driverState.language = settings["ui.language"] || "pt-BR";
  const form = document.getElementById("settingsForm");
  Object.entries(settings).forEach(([key, value]) => {
    const node = form.querySelector(`[name="${key.replaceAll('"', '\\"')}"]`);
    if (!node) {
      return;
    }
    node.value = String(value);
  });
  const filterNode = document.getElementById("driverCategoryFilter");
  const restoreNode = document.getElementById("driverCreateRestorePoint");
  if (filterNode) {
    filterNode.value = driverState.filterCategory;
  }
  if (restoreNode) {
    restoreNode.checked = driverState.createRestorePoint;
  }
}

async function saveDriverPreferences() {
  await apiPost("/settings", {
    "driver.filterCategory": driverState.filterCategory,
    "driver.createRestorePoint": String(driverState.createRestorePoint),
    "ui.language": driverState.language
  });
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
  document.getElementById("runPerformanceScanBtn").addEventListener("click", () => runFullPerformanceReport().catch((e) => toast(e.message)));
  document.getElementById("runApiResponseBtn").addEventListener("click", () => runApiResponseAnalysis().catch((e) => toast(e.message)));
  document.getElementById("runMemoryMonitorBtn").addEventListener("click", () => runMemoryMonitor().catch((e) => toast(e.message)));
  document.getElementById("runRenderBottleneckBtn").addEventListener("click", () => runRenderBottleneckAnalysis());
  document.getElementById("runPageLoadBtn").addEventListener("click", () => runPageLoadAnalysis().catch((e) => toast(e.message)));
  document.getElementById("runBundleSizeBtn").addEventListener("click", () => runBundleSizeAnalysis().catch((e) => toast(e.message)));
  document.getElementById("runSlowComponentsBtn").addEventListener("click", () => runSlowComponentsAnalysis());
  document.getElementById("runNativeProfilerBtn").addEventListener("click", () => openNativeProfiler());
  document.getElementById("exportPerformanceLogsBtn").addEventListener("click", exportPerformanceLogs);
  document.getElementById("loadPerformanceHistoryBtn").addEventListener("click", () => loadPerformanceHistory().catch((e) => toast(e.message)));
  document.getElementById("runSecurityScanBtn").addEventListener("click", () => loadSecurity().catch((e) => toast(e.message)));
  document.getElementById("runDriverCheckBtn").addEventListener("click", () => loadDrivers().catch((e) => toast(e.message)));
  document.getElementById("driverCategoryFilter").addEventListener("change", async (event) => {
    driverState.filterCategory = event.target.value;
    renderDriverTable();
    await saveDriverPreferences().catch(() => null);
  });
  document.getElementById("driverCreateRestorePoint").addEventListener("change", async (event) => {
    driverState.createRestorePoint = event.target.checked;
    await saveDriverPreferences().catch(() => null);
  });
  document.getElementById("driverSelectAll").addEventListener("change", (event) => {
    if (event.target.checked) {
      driverState.items.forEach((item) => driverState.selectedIds.add(item.id));
    } else {
      driverState.selectedIds.clear();
    }
    renderDriverTable();
  });
  document.getElementById("driverReport").addEventListener("change", (event) => {
    if (!event.target.classList.contains("driver-select")) {
      return;
    }
    const driverId = event.target.value;
    if (event.target.checked) {
      driverState.selectedIds.add(driverId);
    } else {
      driverState.selectedIds.delete(driverId);
    }
    updateDriverActionButtons();
  });
  document.getElementById("updateSelectedDriversBtn").addEventListener("click", () => {
    if (!driverState.selectedIds.size) {
      toast(t("noSelection"));
      return;
    }
    openDriverConfirmModal("selected");
  });
  document.getElementById("updateAllDriversBtn").addEventListener("click", () => {
    openDriverConfirmModal("all");
  });
  document.getElementById("cancelDriverUpdateBtn").addEventListener("click", () => {
    driverState.cancelRequested = true;
    toast(t("updateCancelled"));
  });
  document.getElementById("cancelDriverConfirmBtn").addEventListener("click", closeDriverConfirmModal);
  document.getElementById("confirmDriverUpdateBtn").addEventListener("click", () => {
    const mode = document.getElementById("driverConfirmModal").dataset.mode || "selected";
    runDriverUpdates(mode).catch((e) => {
      appendDriverLog(`Erro: ${e.message}`);
      toast(e.message);
    });
  });
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
    requestSoftwareModal("manual");
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
    softwareState.autoPromptEnabled = payload["software.autoPromptUpdates"] === "true";
    driverState.language = payload["ui.language"] || driverState.language;
    await saveDriverPreferences().catch(() => null);
    renderDriverTable();
    toast("Settings saved.");
  });
}

async function bootstrap() {
  wireEvents();
  initializeIcons();
  await loadSettings().catch(() => null);
  await loadDashboard();
  setInterval(() => loadDashboard().catch(() => null), 15000);
  setInterval(() => runAutoPerformanceAlertCheck().catch(() => null), 90000);
  document.getElementById("splash").classList.add("hide");
  toast("Velance System Care ready.");
}

bootstrap().catch((error) => {
  toast(error.message);
});
