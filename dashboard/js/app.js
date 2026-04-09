/* ═══════════════════════════════════════════════════════════════════════════
   ThreatLens Dashboard — Application Logic
   Connects to the Flask-SocketIO backend, renders live charts, alerts, logs.
   ═══════════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────────
  const state = {
    socket: null,
    connected: false,
    serverUrl: "http://localhost:5500",

    // Counters
    totalPackets: 0,
    totalAlerts: 0,
    packetsThisSecond: 0,
    packetsPerSecond: 0,

    // Traffic chart time-series
    trafficTimestamps: [],
    trafficNormal: [],
    trafficAttack: [],
    chartRange: 30,

    // Per-second tick counters (reset every second)
    tickNormal: 0,
    tickAttack: 0,

    // Attack type counters
    attackTypes: {
      "Port Scan": 0,
      "Brute Force": 0,
      "DDoS / Flood": 0,
      "Suspicious": 0,
    },

    // Node tracking  { nodeId: { packets, alerts, lastSeen, lastPPS } }
    nodes: {},

    // Buffers
    alerts: [],
    logs: [],
    lastLogCount: 0,

    // Timers
    pollTimer: null,
    ppsTimer: null,
  };

  // ─── DOM Refs ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const dom = {
    serverUrlInput:   $("server-url-input"),
    connectBtn:       $("connect-btn"),
    statusDot:        $("status-dot"),
    statusText:       $("status-text"),

    totalPackets:     $("total-packets"),
    totalAlerts:      $("total-alerts"),
    attackRate:       $("attack-rate"),
    activeNodes:      $("active-nodes"),
    packetsRate:      $("packets-rate"),
    threatLevel:      $("threat-level"),
    attackTrendText:  $("attack-trend-text"),
    modelStatus:      $("model-status"),

    alertFeed:        $("alert-feed"),
    alertEmptyState:  $("alert-empty-state"),
    alertCountBadge:  $("alert-count-badge"),
    clearAlertsBtn:   $("clear-alerts-btn"),

    logTableBody:     $("log-table-body"),
    logEmptyState:    $("log-empty-state"),
    refreshLogsBtn:   $("refresh-logs-btn"),

    nodeGrid:         $("node-grid"),
    nodeEmptyState:   $("node-empty-state"),

    toastContainer:   $("toast-container"),
  };

  // ─── Charts ───────────────────────────────────────────────────────────────
  let trafficChart = null;
  let attackChart = null;

  function initCharts() {
    // Traffic Line Chart
    const tCtx = $("traffic-chart").getContext("2d");

    const normalGrad = tCtx.createLinearGradient(0, 0, 0, 280);
    normalGrad.addColorStop(0, "rgba(16, 185, 129, 0.25)");
    normalGrad.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    const attackGrad = tCtx.createLinearGradient(0, 0, 0, 280);
    attackGrad.addColorStop(0, "rgba(244, 63, 94, 0.30)");
    attackGrad.addColorStop(1, "rgba(244, 63, 94, 0.0)");

    trafficChart = new Chart(tCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Normal",
            data: [],
            borderColor: "#10b981",
            backgroundColor: normalGrad,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            pointHitRadius: 8,
          },
          {
            label: "Attack",
            data: [],
            borderColor: "#f43f5e",
            backgroundColor: attackGrad,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            pointHitRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              color: "#94a3b8",
              font: { family: "'Inter'", size: 11, weight: "600" },
              boxWidth: 12, boxHeight: 3,
              borderRadius: 2, useBorderRadius: true, padding: 16,
            },
          },
          tooltip: {
            backgroundColor: "rgba(15,20,40,0.92)",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            titleFont: { family: "'Inter'", size: 11 },
            bodyFont: { family: "'JetBrains Mono'", size: 11 },
            padding: 10, cornerRadius: 8,
          },
        },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: {
              color: "#64748b",
              font: { family: "'JetBrains Mono'", size: 10 },
              maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
            },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
            ticks: {
              color: "#64748b",
              font: { family: "'JetBrains Mono'", size: 10 },
              stepSize: 1,
            },
          },
        },
        animation: { duration: 300, easing: "easeOutQuart" },
      },
    });

    // Attack Distribution Doughnut
    const aCtx = $("attack-chart").getContext("2d");

    attackChart = new Chart(aCtx, {
      type: "doughnut",
      data: {
        labels: Object.keys(state.attackTypes),
        datasets: [{
          data: Object.values(state.attackTypes),
          backgroundColor: [
            "rgba(99,102,241,0.8)",
            "rgba(245,158,11,0.8)",
            "rgba(244,63,94,0.8)",
            "rgba(139,92,246,0.8)",
          ],
          borderColor: "rgba(10,14,26,0.8)",
          borderWidth: 3,
          hoverBorderColor: "rgba(255,255,255,0.2)",
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#94a3b8",
              font: { family: "'Inter'", size: 11, weight: "500" },
              boxWidth: 12, boxHeight: 12,
              borderRadius: 3, useBorderRadius: true, padding: 14,
            },
          },
          tooltip: {
            backgroundColor: "rgba(15,20,40,0.92)",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            titleFont: { family: "'Inter'", size: 11 },
            bodyFont: { family: "'JetBrains Mono'", size: 11 },
            padding: 10, cornerRadius: 8,
          },
        },
        animation: { animateRotate: true, duration: 600 },
      },
    });
  }

  // ─── Socket.IO ────────────────────────────────────────────────────────────
  function connectSocket() {
    const url = dom.serverUrlInput.value.trim();
    if (!url) return;
    state.serverUrl = url;
    setConnectionStatus("connecting");

    if (state.socket) state.socket.disconnect();

    try {
      state.socket = io(url, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 8000,
      });

      state.socket.on("connect", () => {
        state.connected = true;
        setConnectionStatus("connected");
        showToast("success", "Connected to ThreatLens server");
        startPolling();
        fetchAlerts();
        fetchLogs();
      });

      state.socket.on("connected", (d) => console.log("[WS]", d.message));

      state.socket.on("alert", (data) => handleIncomingAlert(data));

      state.socket.on("disconnect", () => {
        state.connected = false;
        setConnectionStatus("disconnected");
        showToast("danger", "Disconnected from server");
        stopPolling();
      });

      state.socket.on("connect_error", (err) => {
        state.connected = false;
        setConnectionStatus("disconnected");
        showToast("danger", `Connection failed: ${err.message}`);
        stopPolling();
      });
    } catch (e) {
      setConnectionStatus("disconnected");
      showToast("danger", "Failed to create socket connection");
    }
  }

  function setConnectionStatus(s) {
    dom.statusDot.className = "status-dot";
    if (s === "connected") {
      dom.statusDot.classList.add("status-dot--connected");
      dom.statusText.textContent = "Connected";
      dom.connectBtn.textContent = "Disconnect";
    } else if (s === "connecting") {
      dom.statusDot.classList.add("status-dot--connecting");
      dom.statusText.textContent = "Connecting…";
      dom.connectBtn.textContent = "Cancel";
    } else {
      dom.statusDot.classList.add("status-dot--disconnected");
      dom.statusText.textContent = "Disconnected";
      dom.connectBtn.textContent = "Connect";
    }
  }

  // ─── Polling ──────────────────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    state.lastLogCount = 0;

    state.pollTimer = setInterval(fetchLogs, 3000);

    state.ppsTimer = setInterval(() => {
      state.packetsPerSecond = state.packetsThisSecond;
      state.packetsThisSecond = 0;
      dom.packetsRate.textContent = `${state.packetsPerSecond}/s`;
      pushTrafficTick();
    }, 1000);
  }

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    if (state.ppsTimer) clearInterval(state.ppsTimer);
    state.pollTimer = null;
    state.ppsTimer = null;
  }

  async function fetchAlerts() {
    try {
      const res = await fetch(`${state.serverUrl}/alerts?limit=50`);
      if (!res.ok) return;
      const data = await res.json();
      const seen = new Set(state.alerts.map((a) => a.received_at));
      data.filter((a) => !seen.has(a.received_at)).forEach((a) => processAlert(a, false));
      updateStatsUI();
      updateAttackChart();
    } catch (e) {
      console.warn("[API] fetch alerts failed:", e);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch(`${state.serverUrl}/logs?limit=100`);
      if (!res.ok) return;
      const data = await res.json();

      const newCount = Math.max(0, data.length - state.lastLogCount);
      state.lastLogCount = data.length;
      state.totalPackets += newCount;
      state.packetsThisSecond += newCount;
      state.tickNormal += newCount;

      state.logs = data;
      renderLogTable();
      updateNodeTracking(data);
      updateStatsUI();
    } catch (e) {
      console.warn("[API] fetch logs failed:", e);
    }
  }

  // ─── Alert Processing ────────────────────────────────────────────────────
  function handleIncomingAlert(data) {
    state.tickAttack++;
    if (state.tickNormal > 0) state.tickNormal--;

    processAlert(data, true);
    state.packetsThisSecond++;
    state.totalPackets++;
    updateStatsUI();
    updateAttackChart();

    if (data.confidence > 0.85) {
      document.body.classList.add("shake");
      setTimeout(() => document.body.classList.remove("shake"), 500);
    }
  }

  function processAlert(alert, notify) {
    state.totalAlerts++;
    state.alerts.unshift(alert);
    if (state.alerts.length > 200) state.alerts.pop();

    const type = classifyAttack(alert.features || alert);
    state.attackTypes[type] = (state.attackTypes[type] || 0) + 1;

    const nid = alert.node_id || "unknown";
    if (!state.nodes[nid]) state.nodes[nid] = { packets: 0, alerts: 0, lastSeen: null, lastPPS: 0 };
    state.nodes[nid].alerts++;
    state.nodes[nid].lastSeen = alert.received_at || new Date().toISOString();

    renderAlertItem(alert, type);

    if (notify) {
      const conf = alert.confidence ? (alert.confidence * 100).toFixed(0) : "??";
      showToast("danger", `🚨 Attack on ${nid} — ${type} (${conf}%)`);
    }
  }

  function classifyAttack(f) {
    const ports = f.unique_ports || 0;
    const pps = f.packets_per_sec || 0;
    const conns = f.connection_count || 0;
    if (ports > 20) return "Port Scan";
    if (conns > 100 && pps > 150) return "DDoS / Flood";
    if (conns > 50 && ports <= 3) return "Brute Force";
    return "Suspicious";
  }

  // ─── Traffic Chart Tick ───────────────────────────────────────────────────
  function pushTrafficTick() {
    const now = new Date();
    const label = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

    state.trafficTimestamps.push(label);
    state.trafficNormal.push(state.tickNormal);
    state.trafficAttack.push(state.tickAttack);
    state.tickNormal = 0;
    state.tickAttack = 0;

    const max = state.chartRange;
    if (state.trafficTimestamps.length > max) {
      state.trafficTimestamps.splice(0, state.trafficTimestamps.length - max);
      state.trafficNormal.splice(0, state.trafficNormal.length - max);
      state.trafficAttack.splice(0, state.trafficAttack.length - max);
    }

    if (trafficChart) {
      trafficChart.data.labels = [...state.trafficTimestamps];
      trafficChart.data.datasets[0].data = [...state.trafficNormal];
      trafficChart.data.datasets[1].data = [...state.trafficAttack];
      trafficChart.update("none");
    }
  }

  // ─── Render: Alert Feed ───────────────────────────────────────────────────
  function renderAlertItem(alert, attackType) {
    if (dom.alertEmptyState) dom.alertEmptyState.style.display = "none";

    const conf = alert.confidence ? (alert.confidence * 100).toFixed(0) : "0";
    const severity = conf > 85 ? "high" : conf > 60 ? "medium" : "low";
    const nid = alert.node_id || "unknown";
    const time = fmtTime(alert.received_at);
    const f = alert.features || alert;

    const el = document.createElement("div");
    el.className = "alert-item";
    el.innerHTML = `
      <div class="alert-item__severity alert-item__severity--${severity}"></div>
      <div class="alert-item__content">
        <div class="alert-item__header">
          <span class="alert-item__type">${attackType}</span>
          <span class="alert-item__node">${nid}</span>
        </div>
        <div class="alert-item__details">
          PPS: ${f.packets_per_sec ?? "–"} · Ports: ${f.unique_ports ?? "–"} · Avg: ${f.avg_packet_size ?? "–"}B · Conns: ${f.connection_count ?? "–"}
        </div>
      </div>
      <div class="alert-item__meta">
        <span class="alert-item__confidence">${conf}%</span>
        <span class="alert-item__time">${time}</span>
      </div>`;

    dom.alertFeed.prepend(el);
    while (dom.alertFeed.children.length > 101) dom.alertFeed.removeChild(dom.alertFeed.lastChild);
    dom.alertCountBadge.textContent = state.totalAlerts;
  }

  // ─── Render: Log Table ────────────────────────────────────────────────────
  function renderLogTable() {
    if (!state.logs.length) return;
    if (dom.logEmptyState) dom.logEmptyState.style.display = "none";

    const alertKeys = new Set(
      state.alerts.map((a) => {
        const f = a.features || {};
        return `${f.packets_per_sec}-${f.unique_ports}-${f.avg_packet_size}-${f.connection_count}`;
      })
    );

    const recent = state.logs.slice(-50).reverse();
    let html = "";
    for (const log of recent) {
      const key = `${log.packets_per_sec}-${log.unique_ports}-${log.avg_packet_size}-${log.connection_count}`;
      const isAtk = alertKeys.has(key);
      html += `<tr>
        <td>${fmtTime(log.received_at)}</td>
        <td>${log.node_id || "unknown"}</td>
        <td>${log.packets_per_sec ?? "–"}</td>
        <td>${log.unique_ports ?? "–"}</td>
        <td>${log.avg_packet_size ?? "–"}</td>
        <td>${log.connection_count ?? "–"}</td>
        <td><span class="status-pill status-pill--${isAtk ? "attack" : "normal"}">${isAtk ? "Attack" : "Normal"}</span></td>
      </tr>`;
    }
    dom.logTableBody.innerHTML = html;
  }

  // ─── Render: Node Grid ────────────────────────────────────────────────────
  function updateNodeTracking(logs) {
    const nd = {};
    for (const l of logs) {
      const id = l.node_id || "unknown";
      if (!nd[id]) nd[id] = { packets: 0, lastPPS: 0, lastSeen: null };
      nd[id].packets++;
      nd[id].lastPPS = l.packets_per_sec || 0;
      nd[id].lastSeen = l.received_at;
    }
    for (const [id, d] of Object.entries(nd)) {
      if (!state.nodes[id]) state.nodes[id] = { packets: 0, alerts: 0, lastSeen: null, lastPPS: 0 };
      Object.assign(state.nodes[id], { packets: d.packets, lastPPS: d.lastPPS, lastSeen: d.lastSeen });
    }
    renderNodeGrid();
  }

  function renderNodeGrid() {
    const ids = Object.keys(state.nodes);
    if (!ids.length) return;
    if (dom.nodeEmptyState) dom.nodeEmptyState.style.display = "none";

    const existing = new Set(Array.from(dom.nodeGrid.querySelectorAll(".node-card")).map((c) => c.dataset.nodeId));

    for (const id of ids) {
      const d = state.nodes[id];
      const cls = d.alerts > 0 ? "warning" : "active";

      if (existing.has(id)) {
        const card = dom.nodeGrid.querySelector(`[data-node-id="${id}"]`);
        if (!card) continue;
        card.querySelector(".node-card__status").className = `node-card__status node-card__status--${cls}`;
        const vals = card.querySelectorAll(".node-card__stat-value");
        if (vals[0]) vals[0].textContent = d.packets;
        if (vals[1]) vals[1].textContent = d.alerts;
        if (vals[2]) vals[2].textContent = `${d.lastPPS}/s`;
        if (vals[3]) vals[3].textContent = fmtTime(d.lastSeen);
      } else {
        const card = document.createElement("div");
        card.className = "node-card";
        card.dataset.nodeId = id;
        card.innerHTML = `
          <div class="node-card__header">
            <span class="node-card__name">${id}</span>
            <span class="node-card__status node-card__status--${cls}"></span>
          </div>
          <div class="node-card__stats">
            <div class="node-card__stat"><span class="node-card__stat-label">Packets</span><span class="node-card__stat-value">${d.packets}</span></div>
            <div class="node-card__stat"><span class="node-card__stat-label">Alerts</span><span class="node-card__stat-value">${d.alerts}</span></div>
            <div class="node-card__stat"><span class="node-card__stat-label">PPS</span><span class="node-card__stat-value">${d.lastPPS}/s</span></div>
            <div class="node-card__stat"><span class="node-card__stat-label">Last Seen</span><span class="node-card__stat-value">${fmtTime(d.lastSeen)}</span></div>
          </div>`;
        dom.nodeGrid.appendChild(card);
      }
    }
    dom.activeNodes.textContent = ids.length;
  }

  // ─── Stats UI ─────────────────────────────────────────────────────────────
  function updateStatsUI() {
    dom.totalPackets.textContent = fmtNum(state.totalPackets);
    dom.totalAlerts.textContent = fmtNum(state.totalAlerts);

    const total = state.totalPackets + state.totalAlerts;
    const rate = total > 0 ? ((state.totalAlerts / total) * 100).toFixed(1) : "0";
    dom.attackRate.textContent = `${rate}%`;

    const r = parseFloat(rate);
    const tl = dom.threatLevel;
    const tp = tl.parentElement;
    if (r > 30) { tl.textContent = "Critical"; tp.className = "stat-card__trend stat-card__trend--danger"; }
    else if (r > 15) { tl.textContent = "High"; tp.className = "stat-card__trend stat-card__trend--danger"; }
    else if (r > 5) { tl.textContent = "Medium"; tp.className = "stat-card__trend"; tp.style.background = "rgba(245,158,11,.12)"; tp.style.color = "#f59e0b"; }
    else { tl.textContent = "Low"; tp.className = "stat-card__trend stat-card__trend--up"; tp.style.background = ""; tp.style.color = ""; }

    dom.attackTrendText.textContent = state.totalAlerts > 10 ? "Rising" : state.totalAlerts > 0 ? "Active" : "Stable";
    dom.activeNodes.textContent = Object.keys(state.nodes).length;
  }

  function updateAttackChart() {
    if (!attackChart) return;
    attackChart.data.datasets[0].data = Object.values(state.attackTypes);
    attackChart.update();
    const total = Object.values(state.attackTypes).reduce((a, b) => a + b, 0);
    const dv = $("doughnut-value");
    if (dv) dv.textContent = fmtNum(total);
  }

  // ─── Toasts ───────────────────────────────────────────────────────────────
  function showToast(type, message) {
    const icons = {
      danger:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast__icon"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast__icon"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast__icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };
    const t = document.createElement("div");
    t.className = `toast toast--${type}`;
    t.innerHTML = `${icons[type] || icons.info}<span class="toast__text">${message}</span>`;
    dom.toastContainer.appendChild(t);
    setTimeout(() => { t.classList.add("toast--closing"); setTimeout(() => t.remove(), 300); }, 4000);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────
  function fmtTime(iso) {
    if (!iso) return "–";
    try { return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return iso; }
  }

  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  }

  // ─── Event Binding ────────────────────────────────────────────────────────
  function bindEvents() {
    dom.connectBtn.addEventListener("click", () => {
      if (state.connected) {
        if (state.socket) state.socket.disconnect();
        state.connected = false;
        setConnectionStatus("disconnected");
        stopPolling();
      } else {
        connectSocket();
      }
    });

    dom.serverUrlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); if (!state.connected) connectSocket(); }
    });

    dom.clearAlertsBtn.addEventListener("click", () => {
      state.alerts = [];
      state.totalAlerts = 0;
      state.attackTypes = { "Port Scan": 0, "Brute Force": 0, "DDoS / Flood": 0, "Suspicious": 0 };
      dom.alertFeed.innerHTML = `
        <div class="alert-feed__empty" id="alert-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          <p>No alerts detected — network looks clean</p>
        </div>`;
      dom.alertCountBadge.textContent = "0";
      updateStatsUI();
      updateAttackChart();
      showToast("info", "Alert feed cleared");
    });

    dom.refreshLogsBtn.addEventListener("click", () => { if (state.connected) fetchLogs(); });

    // Chart range chips
    document.querySelectorAll("[data-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("[data-range]").forEach((b) => b.classList.remove("chip--active"));
        btn.classList.add("chip--active");
        state.chartRange = parseInt(btn.dataset.range, 10);
      });
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    bindEvents();
    updateStatsUI();
  });
})();
