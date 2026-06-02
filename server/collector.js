/* watchDocs — Collector.
   Polls every registered service's GET /telemetry (unified contract), or
   synthesizes demo data, and serves the dashboard's aggregated API.

   Endpoints:
     GET  /api/snapshot        full aggregate (dashboard main)
     GET  /api/services        summary array
     GET  /api/services/:id    single service detail
     DELETE /api/services/:id  remove service from registry
     POST /ingest/:id          push-mode telemetry intake
     GET  /healthz             collector self-health
*/
"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");
const synth = require("./synth");

const PORT = parseInt(process.env.PORT || "4000", 10);
const POLL_MS = parseInt(process.env.POLL_MS || "5000", 10);
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT_MS || "3000", 10);
const REGISTRY_PATH = process.env.REGISTRY_PATH || path.join(__dirname, "registry.json");

function loadRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  } catch (e) {
    console.error("[collector] registry load failed:", e.message);
    return [];
  }
}

let registry = loadRegistry();
const pushed = {};            // id -> last pushed contract (push mode)
let observedServiceIds = {};   // registry id -> latest telemetry service id
let snapshot = emptySnapshot();

function emptySnapshot() {
  return { services: [], errors: {}, feedback: {}, deploys: {}, generatedAt: Date.now() };
}

function saveRegistry() {
  const body = JSON.stringify(registry, null, 2) + "\n";
  const tmp = REGISTRY_PATH + ".tmp";
  fs.writeFileSync(tmp, body, "utf8");
  try {
    fs.renameSync(tmp, REGISTRY_PATH);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    if (e.code === "EBUSY" || e.code === "EPERM" || e.code === "EXDEV") {
      fs.writeFileSync(REGISTRY_PATH, body, "utf8");
      return;
    }
    throw e;
  }
}

function removeSnapshotService(id) {
  snapshot.services = snapshot.services.filter((s) => s.id !== id);
  delete snapshot.errors[id];
  delete snapshot.feedback[id];
  delete snapshot.deploys[id];
  snapshot.generatedAt = Date.now();
}

function findRegistryIndexForService(id) {
  let idx = registry.findIndex((entry) => entry.id === id);
  if (idx !== -1) return idx;
  return registry.findIndex((entry) => observedServiceIds[entry.id] === id);
}

// ---- fetch one service's telemetry (pull) with timeout ---------------------
async function pullTelemetry(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// ---- unreachable placeholder contract --------------------------------------
function unreachable(entry, reason) {
  return {
    schema: "watchdocs/telemetry@1",
    service: {
      id: entry.id, name: entry.id, title: entry.title || entry.id, repo: entry.repo || "",
      lang: entry.lang || "", langColor: entry.langColor || "#888", env: entry.env || "", region: entry.region || "",
      version: entry.version || "—", versionState: "deployed",
    },
    health: { status: "critical", score: 0, uptime: 0, uptime30: entry.base ? entry.base.uptime30 : 0 },
    metrics: { reqPerMin: 0, apiCalls24h: 0, errorRate: 100, latencyP95: 0, activeUsers: 0, cpu: 0, mem: 0, disk: 0, net: 0 },
    series: { req: [], err: [], lat: [], cpu: [] },
    errors: [{ sev: "critical", code: "UNREACHABLE", title: "서비스 telemetry 응답 없음 — " + reason, count: 1, delta: "new", lastSeen: Date.now(), endpoint: entry.telemetryUrl || "(push)", trace: "Collector could not reach the service.\n  reason: " + reason }],
    feedback: [],
    deploys: [],
  };
}

// ---- merge a contract into the snapshot ------------------------------------
function applyContract(snap, c) {
  const s = c.service || {};
  const h = c.health || {};
  const m = c.metrics || {};
  const ser = c.series || {};
  const feedback = c.feedback || [];
  const id = s.id;
  if (!id) return;

  const hourAgo = Date.now() - 3600 * 1000;
  const newFeedback = feedback.filter((f) => (f.time || 0) >= hourAgo).length;
  const openIssues = feedback.filter((f) => f.type === "issue").length || (typeof s.openIssues === "number" ? s.openIssues : 0);

  snap.services.push({
    id, name: s.name || id, title: s.title || id, repo: s.repo || "",
    lang: s.lang || "", langColor: s.langColor || "#888", env: s.env || "", region: s.region || "",
    version: s.version || "—", versionState: s.versionState || "deployed",
    status: h.status || "healthy", health: h.score != null ? h.score : 100,
    uptime: h.uptime != null ? h.uptime : 100, uptime30: h.uptime30 != null ? h.uptime30 : 100,
    reqPerMin: m.reqPerMin || 0, apiCalls24h: m.apiCalls24h || 0,
    errorRate: m.errorRate || 0, latencyP95: m.latencyP95 || 0, activeUsers: m.activeUsers || 0,
    cpu: m.cpu || 0, mem: m.mem || 0, disk: m.disk || 0, net: m.net || 0,
    cpuSeries: ser.cpu || [], reqSeries: ser.req || [], errSeries: ser.err || [], latSeries: ser.lat || [],
    openIssues, newFeedback,
  });
  snap.errors[id] = c.errors || [];
  snap.feedback[id] = feedback;
  snap.deploys[id] = c.deploys || [];
}

// ---- one polling cycle -----------------------------------------------------
async function poll() {
  const snap = emptySnapshot();
  const nextObserved = {};
  await Promise.all(
    registry.map(async (entry) => {
      let contract;
      try {
        if (pushed[entry.id]) {
          contract = pushed[entry.id];                 // push mode wins if fresh
        } else if (entry.demo || !entry.telemetryUrl) {
          contract = synth.generate(entry);            // demo synth
        } else {
          contract = await pullTelemetry(entry.telemetryUrl);
        }
      } catch (e) {
        contract = unreachable(entry, e.message || "timeout");
      }
      nextObserved[entry.id] = contract && contract.service && contract.service.id ? contract.service.id : entry.id;
      applyContract(snap, contract);
    })
  );
  observedServiceIds = nextObserved;
  // keep registry order
  const order = registry.map((e) => observedServiceIds[e.id] || e.id);
  snap.services.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  snapshot = snap;
}

// ---- server ----------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));

// permissive CORS so the dashboard can sit on a different origin if needed
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true, services: snapshot.services.length, generatedAt: snapshot.generatedAt, pollMs: POLL_MS });
});

app.get("/api/snapshot", (req, res) => res.json(snapshot));

app.get("/api/services", (req, res) => res.json(snapshot.services));

app.get("/api/services/:id", (req, res) => {
  const id = req.params.id;
  const svc = snapshot.services.find((s) => s.id === id);
  if (!svc) return res.status(404).json({ error: "unknown service: " + id });
  res.json({
    service: svc,
    errors: snapshot.errors[id] || [],
    feedback: snapshot.feedback[id] || [],
    deploys: snapshot.deploys[id] || [],
  });
});

app.delete("/api/services/:id", async (req, res) => {
  const id = req.params.id;
  const idx = findRegistryIndexForService(id);
  if (idx === -1) return res.status(404).json({ error: "unknown service: " + id });

  const [removed] = registry.splice(idx, 1);
  const observedId = observedServiceIds[removed.id] || id;

  try {
    saveRegistry();
  } catch (e) {
    registry = loadRegistry();
    return res.status(500).json({ error: "failed to save registry: " + e.message });
  }

  delete pushed[removed.id];
  delete pushed[observedId];
  delete observedServiceIds[removed.id];
  removeSnapshotService(removed.id);
  if (observedId !== removed.id) removeSnapshotService(observedId);

  try {
    await poll();
  } catch (e) {
    console.error("[collector] poll after delete failed:", e.message);
  }

  res.json({ ok: true, id, removedRegistryId: removed.id, count: registry.length });
});

// push-mode intake: a service sends its own unified contract
app.post("/ingest/:id", (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  if (!body.service || body.service.id !== id) {
    return res.status(400).json({ error: "body.service.id must equal :id" });
  }
  pushed[id] = body;
  // auto-register unknown pushers so they appear on the dashboard
  if (!registry.find((e) => e.id === id)) {
    registry.push({ id, repo: body.service.repo, telemetryUrl: null, demo: false });
  }
  res.json({ ok: true, id });
});

// hot-reload registry (after editing registry.json)
app.post("/admin/reload", (req, res) => {
  registry = loadRegistry();
  res.json({ ok: true, count: registry.length });
});

app.listen(PORT, () => {
  console.log(`[collector] listening on :${PORT} — ${registry.length} services, poll ${POLL_MS}ms`);
  poll();
  setInterval(poll, POLL_MS);
});
