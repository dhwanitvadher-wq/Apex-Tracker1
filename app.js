const STORAGE_PREFIX = "apex_goal_day_";
const GOAL_KEY = "apex_goal_text";
const GOAL_CONFIRMED_KEY = "apex_goal_confirmed";
const TELEMETRY_VIEW_KEY = "apex_telemetry_view";

const metricColors = {
  productivity: "#22FF99",
  consistency: "#2F8DFF",
  punctuality: "#FF7A00",
  revision: "#BC8CFF",
  progress: "#F8FBFF",
};

const orbitSpecs = [
  { name: "Productivity", key: "productivity", color: "#22FF99", tiltX: 0.58, tiltY: 0.18, phase: 0.0, speed: 0.34 },
  { name: "Consistency", key: "consistency", color: "#2F8DFF", tiltX: 0.28, tiltY: -0.52, phase: 0.55, speed: 0.30 },
  { name: "Punctuality", key: "punctuality", color: "#FF9A2F", tiltX: -0.40, tiltY: 0.36, phase: 1.10, speed: 0.38 },
  { name: "Revision", key: "revision", color: "#BC8CFF", tiltX: 0.12, tiltY: 0.72, phase: 1.75, speed: 0.27 },
  { name: "Goal Progress", key: "progress", color: "#F8FBFF", tiltX: -0.66, tiltY: -0.20, phase: 2.30, speed: 0.32 },
];

let selectedDate = new Date();
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let goalText = readStorage(GOAL_KEY, "");
let goalConfirmed = readStorage(GOAL_CONFIRMED_KEY, "false") === "true" && goalText.length > 0;
let telemetryView = readStorage(TELEMETRY_VIEW_KEY, "all");
if (!["all", "mass"].includes(telemetryView)) telemetryView = "all";
let state = loadDay(dateKey(selectedDate));
let deferredInstallPrompt = null;
let animationFrame = 0;

const $ = (id) => document.getElementById(id);

function readStorage(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The app still works for the current session if storage is unavailable.
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultDay(key) {
  return {
    dateString: key,
    tasks: [],
    hasBacklog: false,
    backlogCleared: false,
    backlogNote: "",
    revisionDone: false,
    revisionNote: "",
    reviewText: "",
  };
}

function loadDay(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return normalizeDay(raw ? JSON.parse(raw) : defaultDay(key), key);
  } catch {
    return defaultDay(key);
  }
}

function saveDay() {
  state = normalizeDay(state, state.dateString);
  writeStorage(STORAGE_PREFIX + state.dateString, JSON.stringify(state));
}

function normalizeDay(day, key) {
  const normalized = { ...defaultDay(key), ...day };
  normalized.tasks = Array.isArray(normalized.tasks) ? normalized.tasks : [];
  normalized.hasBacklog = Boolean(normalized.hasBacklog);
  normalized.backlogCleared = normalized.hasBacklog ? Boolean(normalized.backlogCleared) : false;
  normalized.backlogNote = String(normalized.backlogNote || "");
  normalized.revisionDone = Boolean(normalized.revisionDone);
  normalized.revisionNote = String(normalized.revisionNote || "");
  normalized.reviewText = String(normalized.reviewText || "");
  return normalized;
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function calculateMetrics(day = state) {
  const totalTasks = day.tasks.length;
  const completedTasks = day.tasks.filter((task) => task.completed).length;
  const onTimeTasks = day.tasks.filter((task) => task.completed && task.onTime).length;
  const totalHours = day.tasks.reduce((sum, task) => sum + Number(task.targetHours || 0), 0);
  const actualHours = day.tasks.reduce((sum, task) => sum + Number(task.actualHours || 0), 0);

  let productivity = totalTasks ? completedTasks / totalTasks : 0;
  if (day.hasBacklog && !day.backlogCleared) productivity = Math.max(0, productivity - 0.18);
  if (day.hasBacklog && day.backlogCleared) productivity = Math.min(1, productivity + 0.08);

  const consistency = totalHours ? Math.min(1, actualHours / totalHours) : 0;

  let punctuality = completedTasks ? onTimeTasks / completedTasks : 0;
  if (day.hasBacklog && !day.backlogCleared) punctuality = Math.max(0, punctuality - 0.15);

  const revision = day.revisionDone ? 1 : 0;
  const progress = Math.min(
    1,
    productivity * 0.34 + consistency * 0.22 + punctuality * 0.24 + revision * 0.20,
  );

  return { productivity, consistency, punctuality, revision, progress };
}

function render() {
  renderMission();
  $("dateLabel").textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  $("goalStatus").textContent = goalText
    ? `Tracking progress for: ${goalText}`
    : "Set a goal to personalize the dashboard.";

  renderCalendar();
  renderMetrics();
  renderTasks();
  renderCoreAreas();
  $("reviewInput").value = state.reviewText || "";
  $("summaryText").textContent = summaryText();
  safeDrawSphere(performance.now());
}

function renderMission() {
  const editor = $("missionEditor");
  const input = $("goalInput");
  const missionText = $("missionText");
  input.value = goalText;
  if (goalConfirmed && goalText) {
    editor.classList.add("vanish");
    missionText.hidden = false;
    missionText.textContent = goalText;
  } else {
    editor.classList.remove("vanish");
    missionText.hidden = true;
  }
}

function renderCalendar() {
  $("monthLabel").textContent = visibleMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const grid = $("monthGrid");
  grid.innerHTML = "";
  const first = new Date(visibleMonth);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = dateKey(date);
    const button = document.createElement("button");
    button.className = "day-cell";
    if (date.getMonth() !== visibleMonth.getMonth()) button.classList.add("muted");
    if (key === dateKey(new Date())) button.classList.add("today");
    if (key === state.dateString) button.classList.add("active");
    const hasData = readStorage(STORAGE_PREFIX + key, "");
    button.innerHTML = `<span>${date.getDate()}</span>${hasData ? '<i class="day-dot"></i>' : ""}`;
    button.onclick = () => {
      selectedDate = date;
      state = loadDay(key);
      render();
    };
    grid.appendChild(button);
  }
}

function metricItems() {
  const metrics = calculateMetrics();
  return [
    ["Productivity", "productivity", metrics.productivity],
    ["Consistency", "consistency", metrics.consistency],
    ["Punctuality", "punctuality", metrics.punctuality],
    ["Revision", "revision", metrics.revision],
    ["Goal Progress", "progress", metrics.progress],
  ];
}

function renderMetrics() {
  $("allViewBtn").classList.toggle("active", telemetryView === "all");
  $("massViewBtn").classList.toggle("active", telemetryView === "mass");
  $("allTelemetry").hidden = telemetryView !== "all";
  $("massTelemetry").hidden = telemetryView !== "mass";

  const circles = $("circleMetrics");
  const bars = $("barMetrics");
  const mass = $("massTelemetry");
  circles.innerHTML = "";
  bars.innerHTML = "";
  mass.innerHTML = "";

  for (const [name, key, value] of metricItems()) {
    const color = metricColors[key];
    const circle = document.createElement("article");
    circle.className = "metric-card";
    circle.innerHTML = `
      <div class="ring" style="--value:${Math.round(value * 100)}; --metric-color:${color}">
        <span>${percent(value)}</span>
      </div>
      <div class="metric-name">${name}</div>`;
    circles.appendChild(circle);

    const bar = document.createElement("div");
    bar.className = "bar-row";
    bar.innerHTML = `
      <div class="bar-top"><span>${name}</span><strong>${percent(value)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="--value:${Math.round(value * 100)}; --metric-color:${color}"></div></div>`;
    bars.appendChild(bar);
  }

  const metrics = calculateMetrics();
  mass.innerHTML = `
    <article class="mass-card">
      <span>Execution Mass</span>
      <strong>${percent(metrics.progress)}</strong>
      <p class="summary">${summaryText()}</p>
    </article>`;
}

function startVisualEngine() {
  const ambient = $("ambientCanvas");
  const actx = ambient.getContext("2d");
  const sphere = $("sphereCanvas");
  const sctx = sphere.getContext("2d");
  const particles = Array.from({ length: 92 }, (_, index) => ({
    x: (Math.random() - 0.5) * 2.4,
    y: (Math.random() - 0.5) * 1.7,
    z: Math.random() * 1.6 + 0.25,
    vx: (Math.random() - 0.5) * 0.00012,
    vy: (Math.random() - 0.5) * 0.00010,
    vz: 0.00018 + Math.random() * 0.00024,
    hue: index % 5,
  }));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ambient.width = Math.floor(window.innerWidth * dpr);
    ambient.height = Math.floor(window.innerHeight * dpr);
    ambient.style.width = `${window.innerWidth}px`;
    ambient.style.height = `${window.innerHeight}px`;
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(time) {
    actx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const projected = [];
    const depth = Math.min(window.innerWidth, window.innerHeight) * 0.78;

    for (const p of particles) {
      p.x += p.vx + Math.sin(time / 2600 + p.z * 3) * 0.00006;
      p.y += p.vy + Math.cos(time / 3100 + p.x * 2) * 0.00005;
      p.z -= p.vz;
      if (p.z < 0.18 || Math.abs(p.x) > 1.35 || Math.abs(p.y) > 1.02) {
        p.x = (Math.random() - 0.5) * 2.2;
        p.y = (Math.random() - 0.5) * 1.55;
        p.z = 1.75;
      }

      const scale = depth / (depth + p.z * 420);
      const sx = window.innerWidth / 2 + p.x * window.innerWidth * 0.46 * scale;
      const sy = window.innerHeight / 2 + p.y * window.innerHeight * 0.58 * scale;
      const alpha = Math.max(0.06, 0.34 * (1.85 - p.z));
      projected.push({ sx, sy, alpha, scale, hue: p.hue });
    }

    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const a = projected[i];
        const b = projected[j];
        const distance = Math.hypot(a.sx - b.sx, a.sy - b.sy);
        if (distance < 118) {
          actx.strokeStyle = `rgba(34,255,153,${(1 - distance / 118) * 0.055})`;
          actx.lineWidth = 1;
          actx.beginPath();
          actx.moveTo(a.sx, a.sy);
          actx.lineTo(b.sx, b.sy);
          actx.stroke();
        }
      }
    }

    for (const p of projected) {
      const color = p.hue === 0 ? "34,255,153" : p.hue === 1 ? "47,141,255" : p.hue === 2 ? "255,154,47" : p.hue === 3 ? "188,140,255" : "248,251,255";
      const r = 0.7 + p.scale * 2.2;
      actx.beginPath();
      actx.fillStyle = `rgba(${color},${p.alpha})`;
      actx.shadowColor = `rgba(${color},0.55)`;
      actx.shadowBlur = 9 + p.scale * 8;
      actx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      actx.fill();
      actx.shadowBlur = 0;
    }

    safeDrawSphere(time, sctx, sphere);
    animationFrame = requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(frame);
}

function safeDrawSphere(time, providedContext, providedCanvas) {
  try {
    drawSphere(time, providedContext, providedCanvas);
  } catch (error) {
    console.error("Sphere render failed", error);
  }
}

function drawSphere(time, providedContext, providedCanvas) {
  const canvas = providedCanvas || $("sphereCanvas");
  const ctx = providedContext || canvas.getContext("2d");
  const metrics = calculateMetrics();
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.245;
  const progress = metrics.progress;

  $("coreScore").textContent = percent(metrics.progress);
  ctx.clearRect(0, 0, w, h);

  const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.min(w, h) * 0.48);
  aura.addColorStop(0, "rgba(34,255,153,0.34)");
  aura.addColorStop(0.38, "rgba(34,255,153,0.11)");
  aura.addColorStop(1, "rgba(34,255,153,0)");
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.48, 0, Math.PI * 2);
  ctx.fill();

  drawDecorativeOrbit(ctx, cx, cy, baseRadius * 1.28, time, 0.24, 0.44, "rgba(34,255,153,0.16)");
  drawDecorativeOrbit(ctx, cx, cy, baseRadius * 1.05, time, -0.34, 0.33, "rgba(34,255,153,0.20)");
  drawDecorativeOrbit(ctx, cx, cy, baseRadius * 0.82, time, 0.82, 0.40, "rgba(248,251,255,0.12)");
  drawNucleus(ctx, cx, cy, baseRadius * 0.82, time);

  const ringRadius = baseRadius * 1.34;
  drawMainProgressArc(ctx, cx, cy, ringRadius, progress);

  drawSatelliteMetric(ctx, cx, cy, ringRadius, time, -0.05, metrics.productivity, "#2F8DFF", "Productivity");
  drawSatelliteMetric(ctx, cx, cy, ringRadius, time, 0.62, metrics.punctuality, "#FF9A2F", "Punctuality");
  drawSatelliteMetric(ctx, cx, cy, ringRadius, time, 1.17, metrics.revision, "#F8FBFF", "Revision");
}

function drawDecorativeOrbit(ctx, cx, cy, radius, time, rotate, scaleY, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate + time / 14000);
  ctx.scale(1, scaleY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMainProgressArc(ctx, cx, cy, radius, value) {
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  const start = Math.PI * 0.78;
  const span = Math.PI * 2 * Math.max(0.015, Math.min(1, value));
  ctx.strokeStyle = "#22FF99";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.shadowColor = "#22FF99";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, start + span);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSatelliteMetric(ctx, cx, cy, radius, time, phase, value, color, label) {
  const angle = time / 9000 + phase * Math.PI * 2;
  const x = cx + Math.cos(angle) * radius * 0.92;
  const y = cy + Math.sin(angle) * radius * 0.56;
  const r = 32;

  ctx.fillStyle = "rgba(2,4,5,0.86)";
  ctx.strokeStyle = "rgba(255,255,255,0.30)";
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.015, value));
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#F8FBFF";
  ctx.font = "950 14px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(percent(value), x, y + 5);
  ctx.fillStyle = "rgba(242,255,249,0.72)";
  ctx.font = "850 10px system-ui";
  ctx.fillText(label, x, y + 44);
}

function drawNucleus(ctx, cx, cy, radius, time) {
  const points = [];
  for (let lat = -5; lat <= 5; lat++) {
    for (let lon = 0; lon < 28; lon++) {
      const theta = (lon / 28) * Math.PI * 2 + time / 5200;
      const y = (lat / 5) * radius * 0.95;
      const ring = Math.sqrt(Math.max(0, radius * radius - y * y));
      const x = Math.cos(theta) * ring;
      const z = Math.sin(theta) * ring;
      points.push({ x: cx + x, y: cy + y * 0.84 + z * 0.10, z });
    }
  }

  ctx.lineWidth = 0.75;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const next = points[(i + 1) % points.length];
    if (Math.abs(p.y - next.y) < 18) {
      ctx.strokeStyle = `rgba(34,255,153,${p.z > 0 ? 0.24 : 0.08})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
    }
  }

  for (const p of points) {
    const alpha = p.z > 0 ? 0.92 : 0.26;
    ctx.fillStyle = `rgba(34,255,153,${alpha})`;
    ctx.shadowColor = "rgba(34,255,153,0.9)";
    ctx.shadowBlur = p.z > 0 ? 9 : 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.z > 0 ? 1.9 : 1.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function drawBoundedOrbit(ctx, cx, cy, radius, value, spec, time) {
  const maxArc = Math.PI * 2 * value;
  const origin = -Math.PI / 2 + spec.phase;
  drawOrbitSegment(ctx, cx, cy, radius, spec, origin, Math.PI * 2, "rgba(255,255,255,0.040)", 1.35, 0);

  if (value <= 0.001) {
    return;
  }

  drawOrbitSegment(ctx, cx, cy, radius, spec, origin, maxArc, spec.color, 5.2, 18);
  drawTerminalWall(ctx, cx, cy, radius, spec, origin, spec.color);
  drawTerminalWall(ctx, cx, cy, radius, spec, origin + maxArc, spec.color);

  const bounce = trappedProgress(time, spec.speed, value);
  const electronAngle = origin + maxArc * bounce;
  const electron = projectOrbitPoint(cx, cy, radius, electronAngle, spec);

  ctx.fillStyle = spec.color;
  ctx.shadowColor = spec.color;
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.arc(electron.x, electron.y, 7.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "rgba(248,251,255,0.86)";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(spec.name, electron.x, electron.y - 17);
}

function drawOrbitSegment(ctx, cx, cy, radius, spec, start, span, color, lineWidth, blur) {
  if (span <= 0.001) return;
  const steps = Math.max(10, Math.ceil(Math.abs(span) / (Math.PI * 2) * 150));
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const angle = start + (span * i) / steps;
    const point = projectOrbitPoint(cx, cy, radius, angle, spec);
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawTerminalWall(ctx, cx, cy, radius, spec, angle, color) {
  const point = projectOrbitPoint(cx, cy, radius, angle, spec);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function projectOrbitPoint(cx, cy, radius, angle, spec) {
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const rotate = spec.phase * 0.36;
  const rx = x * Math.cos(rotate) - y * Math.sin(rotate);
  const ry = x * Math.sin(rotate) + y * Math.cos(rotate);
  const depth = Math.sin(angle + spec.phase) * 0.10;
  return {
    x: cx + rx + ry * spec.tiltY * 0.12,
    y: cy + rx * spec.tiltX * 0.16 + ry * (0.50 + Math.abs(spec.tiltX) * 0.11) + depth * radius,
  };
}

function trappedProgress(time, speed, value) {
  if (value >= 0.999) return (time * speed / 3200) % 1;
  const cycle = (time * speed / 2400) % 2;
  return cycle <= 1 ? cycle : 2 - cycle;
}
function renderTasks() {
  const list = $("taskList");
  list.innerHTML = "";
  if (!state.tasks.length) {
    const empty = document.createElement("p");
    empty.className = "summary";
    empty.textContent = "No tasks yet. Add the first task for this date.";
    list.appendChild(empty);
    return;
  }

  state.tasks.forEach((task, index) => {
    const card = document.createElement("article");
    card.className = "task-card";
    card.innerHTML = `
      <div class="task-top">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p class="task-meta">Target ${Number(task.targetHours || 0).toFixed(2)}h</p>
        </div>
        <input type="number" min="0" step="0.25" value="${Number(task.actualHours || 0).toFixed(1)}" aria-label="Actual hours" />
      </div>
      <div class="task-actions">
        <button class="${task.completed ? "chip-on" : ""}">Completed</button>
        <button class="${task.onTime ? "chip-on" : ""}" ${!task.completed ? "disabled" : ""}>On-Time</button>
        <button class="danger">Delete</button>
      </div>`;
    const hours = card.querySelector("input");
    const [completed, onTime, remove] = card.querySelectorAll("button");
    hours.onchange = () => {
      task.actualHours = Number(hours.value || 0);
      saveDay();
      render();
    };
    completed.onclick = () => {
      task.completed = !task.completed;
      if (!task.completed) task.onTime = false;
      saveDay();
      render();
    };
    onTime.onclick = () => {
      task.onTime = !task.onTime;
      saveDay();
      render();
    };
    remove.onclick = () => {
      state.tasks.splice(index, 1);
      saveDay();
      render();
    };
    list.appendChild(card);
  });
}

function renderCoreAreas() {
  $("hasBacklog").checked = !!state.hasBacklog;
  $("backlogCleared").checked = !!state.backlogCleared;
  $("backlogCleared").disabled = !state.hasBacklog;
  $("backlogNote").value = state.backlogNote || "";
  $("revisionDone").checked = !!state.revisionDone;
  $("revisionNote").value = state.revisionNote || "";

  const backlogImpact = $("backlogImpact");
  if (!state.hasBacklog) {
    backlogImpact.textContent = "No backlog";
    backlogImpact.className = "status-pill";
  } else if (state.backlogCleared) {
    backlogImpact.textContent = "Cleared";
    backlogImpact.className = "status-pill good";
  } else {
    backlogImpact.textContent = "Affecting score";
    backlogImpact.className = "status-pill bad";
  }

  const revisionImpact = $("revisionImpact");
  revisionImpact.textContent = state.revisionDone ? "Completed" : "Pending";
  revisionImpact.className = state.revisionDone ? "status-pill good" : "status-pill";
}

function summaryText() {
  const metrics = calculateMetrics();
  const goal = goalText || "your goal";
  if (!goalText) return "Type your goal first, then build today's execution plan.";
  if (state.hasBacklog && !state.backlogCleared) {
    return `Backlog is active, so ${goal} progress is being penalized. Clear it or define the next recovery action.`;
  }
  if (metrics.progress >= 0.85) {
    return `Excellent execution for ${goal}: progress is ${percent(metrics.progress)} today. Protect this rhythm tomorrow.`;
  }
  if (metrics.productivity < 0.45) {
    return `Low output today. Choose one small task that moves ${goal} forward and finish it fully.`;
  }
  if (!state.revisionDone) {
    return `Good movement, but revision/reflection is still pending. Close the day by reviewing what worked and what failed.`;
  }
  return `Balanced day for ${goal}: productivity ${percent(metrics.productivity)}, consistency ${percent(metrics.consistency)}, progress ${percent(metrics.progress)}.`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

$("goalInput").addEventListener("input", (event) => {
  goalText = event.target.value.trim();
  goalConfirmed = false;
  writeStorage(GOAL_KEY, goalText);
  writeStorage(GOAL_CONFIRMED_KEY, "false");
  $("goalStatus").textContent = goalText
    ? `Press Enter or OK to lock mission: ${goalText}`
    : "Set a goal to personalize the system.";
});

$("missionEditor").addEventListener("submit", (event) => {
  event.preventDefault();
  confirmMission();
});

$("missionText").onclick = () => {
  goalConfirmed = false;
  writeStorage(GOAL_CONFIRMED_KEY, "false");
  render();
  $("goalInput").focus();
};

function confirmMission() {
  goalText = $("goalInput").value.trim();
  if (!goalText) return;
  goalConfirmed = true;
  writeStorage(GOAL_KEY, goalText);
  writeStorage(GOAL_CONFIRMED_KEY, "true");
  render();
}

$("prevMonthBtn").onclick = () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  renderCalendar();
};

$("nextMonthBtn").onclick = () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  renderCalendar();
};

$("allViewBtn").onclick = () => {
  telemetryView = "all";
  writeStorage(TELEMETRY_VIEW_KEY, telemetryView);
  renderMetrics();
};

$("massViewBtn").onclick = () => {
  telemetryView = "mass";
  writeStorage(TELEMETRY_VIEW_KEY, telemetryView);
  renderMetrics();
};

$("addTaskBtn").onclick = () => $("taskDialog").showModal();

$("saveTaskBtn").onclick = (event) => {
  event.preventDefault();
  const title = $("customTitle").value.trim();
  const targetHours = Number($("customHours").value || 1);
  if (!title) return;
  state.tasks.push({ title, targetHours, actualHours: 0, completed: false, onTime: false });
  $("customTitle").value = "";
  $("customHours").value = "1";
  saveDay();
  $("taskDialog").close();
  render();
};

$("hasBacklog").onchange = (event) => {
  state.hasBacklog = event.target.checked;
  if (!state.hasBacklog) state.backlogCleared = false;
  saveDay();
  render();
};

$("backlogCleared").onchange = (event) => {
  const checked = event.target.checked;
  if (checked) state.hasBacklog = true;
  state.backlogCleared = checked;
  saveDay();
  render();
};

$("backlogNote").oninput = (event) => {
  state.backlogNote = event.target.value;
  saveDay();
};

$("revisionDone").onchange = (event) => {
  state.revisionDone = event.target.checked;
  saveDay();
  render();
};

$("revisionNote").oninput = (event) => {
  state.revisionNote = event.target.value;
  saveDay();
};

$("reviewInput").oninput = (event) => {
  state.reviewText = event.target.value;
  saveDay();
};

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $("installBtn").hidden = false;
});

$("installBtn").onclick = async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("installBtn").hidden = true;
};

window.addEventListener("error", (event) => {
  console.error("Apex runtime error", event.error || event.message);
  document.documentElement.classList.add("runtime-safe-mode");
});

function bootApp() {
  render();
  startVisualEngine();
}

try {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  bootApp();
} catch (error) {
  console.error("Apex boot failed", error);
  document.documentElement.classList.add("runtime-safe-mode");
}

