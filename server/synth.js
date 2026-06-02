/* watchDocs — demo telemetry synthesizer.
   For registry entries marked demo:true (no real telemetryUrl), produce a
   plausible, jittering payload in the UNIFIED CONTRACT shape — exactly what a
   real service's GET /telemetry would return. Lets `docker compose up` show a
   live dashboard with zero external services. */
"use strict";

const STATUS_BY_PROFILE = {
  healthy: "healthy",
  warning: "warning",
  degraded: "degraded",
  critical: "critical",
};

function rnd(a, b) { return a + Math.random() * (b - a); }
function jitter(v, pct) { return Math.max(0, v * (1 + (Math.random() - 0.5) * pct)); }
function series(n, base, jit, trend) {
  const out = []; let v = base;
  for (let i = 0; i < n; i++) { v += (Math.random() - 0.5) * jit + (trend || 0); out.push(+Math.max(0, v).toFixed(2)); }
  return out;
}
function spike(n, base, jit, at, mag) {
  const out = series(n, base, jit);
  for (let i = at; i < Math.min(n, at + 6); i++) out[i] += mag * (1 - (i - at) / 6);
  return out.map((x) => +Math.max(0, x).toFixed(2));
}

// representative errors per profile
function errorsFor(entry, now) {
  const min = 60000;
  if (entry.profile === "critical") {
    return [
      { sev: "critical", code: "ECONNRESET", title: "Upstream origin connection reset", count: Math.round(jitter(1284, 0.1)), delta: "+1180", lastSeen: now - rnd(20, 60) * 1000, endpoint: "GET /assets/:id", trace: "net/http: TLS handshake timeout\n  at originPool.dial (origin/pool.go:212)\n  at proxy.forward (proxy/forward.go:88)" },
      { sev: "critical", code: "503", title: "Service unavailable — pool exhausted", count: Math.round(jitter(642, 0.1)), delta: "+610", lastSeen: now - rnd(40, 90) * 1000, endpoint: "GET /stream/:key", trace: "origin pool exhausted (max=64, in-use=64)\n  at originPool.acquire (origin/pool.go:140)" },
      { sev: "warning", code: "ETIMEDOUT", title: "Cache write timed out", count: Math.round(jitter(211, 0.2)), delta: "+88", lastSeen: now - rnd(1, 3) * min, endpoint: "internal/cache", trace: "redis: write timeout after 200ms\n  at cache.set (cache/redis.go:64)" },
    ];
  }
  if (entry.profile === "warning" || entry.profile === "degraded") {
    return [
      { sev: "warning", code: "504", title: "Gateway timeout on slow query", count: Math.round(jitter(96, 0.2)), delta: "+22", lastSeen: now - rnd(2, 6) * min, endpoint: "POST /query", trace: "exceeded 1500ms budget\n  at exec.run (exec.ts:128)" },
      { sev: "warning", code: "429", title: "Rate limit exceeded", count: Math.round(jitter(73, 0.2)), delta: "+10", lastSeen: now - rnd(3, 7) * min, endpoint: "POST /messages", trace: "rate limiter tripped\n  at limiter.check (rate.ts:33)" },
    ];
  }
  return [
    { sev: "info", code: "400", title: "Malformed payload", count: Math.round(jitter(38, 0.2)), delta: "-3", lastSeen: now - rnd(5, 12) * min, endpoint: "POST /ingest", trace: "invalid JSON at position 14\n  at parseBody (body.ts:22)" },
  ];
}

function feedbackFor(entry, now) {
  const min = 60000;
  const pool = [
    { type: "issue", sev: "high", title: "기능이 간헐적으로 동작하지 않아요", author: "minseo_k", channel: `GitHub #${100 + Math.floor(Math.random() * 400)}`, up: Math.round(rnd(10, 40)), tag: "bug" },
    { type: "feedback", sev: "med", title: "응답이 느릴 때가 있어요", author: "support", channel: "Intercom", up: Math.round(rnd(4, 18)), tag: "performance" },
    { type: "feedback", sev: "low", title: "다크모드 대비가 약해요", author: "user_" + Math.floor(Math.random() * 9999), channel: "In-app", up: Math.round(rnd(2, 9)), tag: "ui" },
    { type: "issue", sev: "med", title: "엣지 케이스에서 오류 발생", author: "qa_team", channel: `GitHub #${50 + Math.floor(Math.random() * 80)}`, up: Math.round(rnd(5, 15)), tag: "bug" },
  ];
  const n = entry.profile === "healthy" ? 1 : entry.profile === "critical" ? 4 : 2;
  return pool.slice(0, n).map((f, i) => ({ ...f, time: now - rnd(5, 90) * min }));
}

function deploysFor(entry, now) {
  const min = 60000;
  if (entry.versionState === "rolling-back") {
    return [
      { kind: "rollback", sha: "a91f3c2", msg: "Rollback — regression in latest release", author: "oncall", time: now - rnd(8, 12) * min, state: "in-progress" },
      { kind: "deploy", sha: "7e2d11b", msg: "feat: adaptive pool sizing", author: "minseo_k", time: now - rnd(13, 18) * min, state: "failed" },
      { kind: "commit", sha: "3c8a740", msg: "perf: reuse TLS sessions", author: "minseo_k", time: now - rnd(24, 30) * min, state: "ok" },
    ];
  }
  if (entry.versionState === "deploying") {
    return [
      { kind: "deploy", sha: "ff3e881", msg: "fix: drain queue on SIGTERM", author: "oncall", time: now - rnd(1, 3) * min, state: "in-progress" },
      { kind: "commit", sha: "5d77a22", msg: "feat: exponential backoff", author: "backend_oh", time: now - rnd(28, 34) * min, state: "ok" },
    ];
  }
  return [
    { kind: "deploy", sha: Math.random().toString(16).slice(2, 9), msg: "feat: ship " + entry.version, author: "ci-bot", time: now - rnd(30, 200) * min, state: "ok" },
  ];
}

/** Generate a unified-contract telemetry payload for a demo registry entry. */
function generate(entry) {
  const b = entry.base;
  const now = Date.now();
  const crit = entry.profile === "critical";
  const at = 30;

  const cpuSeries = crit ? spike(48, b.cpu * 0.7, 8, at, 30) : series(48, b.cpu, 8, 0.2);
  const reqSeries = crit ? spike(48, b.reqPerMin * 0.85, b.reqPerMin * 0.1, at, b.reqPerMin * 0.35) : series(48, b.reqPerMin, b.reqPerMin * 0.1);
  const errSeries = crit ? spike(48, b.errorRate * 0.4, 0.4, at, b.errorRate) : series(48, b.errorRate, b.errorRate * 0.4 + 0.05);
  const latSeries = crit ? spike(48, b.latencyP95 * 0.5, 60, at, b.latencyP95 * 0.7) : series(48, b.latencyP95, b.latencyP95 * 0.15);

  const feedback = feedbackFor(entry, now);
  const score = entry.profile === "healthy" ? Math.round(rnd(90, 99))
    : entry.profile === "critical" ? Math.round(rnd(38, 48))
    : Math.round(rnd(60, 75));

  return {
    schema: "watchdocs/telemetry@1",
    service: {
      id: entry.id, name: entry.id, title: entry.title, repo: entry.repo,
      lang: entry.lang, langColor: entry.langColor, env: entry.env, region: entry.region,
      version: entry.version, versionState: entry.versionState,
    },
    health: {
      status: STATUS_BY_PROFILE[entry.profile] || "healthy",
      score,
      uptime: b.uptime,
      uptime30: b.uptime30,
    },
    metrics: {
      reqPerMin: Math.round(jitter(b.reqPerMin, 0.06)),
      apiCalls24h: b.apiCalls24h,
      errorRate: +jitter(b.errorRate, 0.15).toFixed(2),
      latencyP95: Math.round(jitter(b.latencyP95, 0.08)),
      activeUsers: Math.round(jitter(b.activeUsers, 0.04)),
      cpu: Math.round(jitter(b.cpu, 0.06)),
      mem: Math.round(jitter(b.mem, 0.04)),
      disk: b.disk,
      net: Math.round(jitter(b.net, 0.12)),
    },
    series: { req: reqSeries, err: errSeries, lat: latSeries, cpu: cpuSeries },
    errors: errorsFor(entry, now),
    feedback,
    deploys: deploysFor(entry, now),
  };
}

module.exports = { generate };
