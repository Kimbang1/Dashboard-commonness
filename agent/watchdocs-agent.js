/* watchdocs-agent — drop-in telemetry for Node/Express services.
 *
 * 한 줄로 표준 GET /telemetry 를 노출합니다. 다른 언어는 API.md의 JSON을
 * 그대로 반환하면 동일하게 동작합니다.
 *
 *   const { watchdocsAgent } = require("./watchdocs-agent");
 *   app.use(watchdocsAgent({
 *     service: { id: "media-cdn", title: "Media CDN", repo: "watchdocs/media-cdn",
 *                lang: "JavaScript", version: process.env.APP_VERSION },
 *     // 선택: 외부 소스에서 채우는 훅 (GitHub 이슈/커밋 등)
 *     collectErrors:   async () => [],
 *     collectFeedback: async () => [],   // GitHub Issues API 결과를 매핑
 *     collectDeploys:  async () => [],   // GitHub commits/deployments
 *   }));
 *
 * 자동 측정: 요청수(req/min), 에러율(5xx 비율), 지연 P95, CPU/메모리.
 * 디스크/네트워크는 환경마다 달라 0으로 두거나 옵션으로 주입하세요.
 */
"use strict";

const os = require("os");

function watchdocsAgent(opts) {
  opts = opts || {};
  const svc = Object.assign(
    { id: "service", name: null, title: null, repo: "", lang: "", langColor: "#888",
      env: process.env.NODE_ENV || "production", region: process.env.REGION || "",
      version: process.env.APP_VERSION || "v0.0.0", versionState: "deployed" },
    opts.service || {}
  );
  svc.name = svc.name || svc.id;
  svc.title = svc.title || svc.id;

  const path = opts.path || "/telemetry";
  const windowMs = opts.windowMs || 60000;            // rolling 1-minute window
  const histN = opts.seriesPoints || 48;

  // rolling counters
  let reqTimes = [];          // request timestamps (for req/min)
  let errCount = 0;           // 5xx in window
  let totalInWindow = 0;
  let latencies = [];         // recent latencies for P95
  let apiCalls24h = 0;

  // rolling series (sampled each windowMs)
  const reqSeries = new Array(histN).fill(0);
  const errSeries = new Array(histN).fill(0);
  const latSeries = new Array(histN).fill(0);
  const cpuSeries = new Array(histN).fill(0);

  function p95(arr) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length * 0.95)] || s[s.length - 1]);
  }
  function cpuPct() {
    // load average over core count → rough %
    const cores = os.cpus().length || 1;
    return Math.min(100, Math.round((os.loadavg()[0] / cores) * 100));
  }
  function memPct() {
    return Math.round((1 - os.freemem() / os.totalmem()) * 100);
  }

  // sample into series every window
  setInterval(() => {
    const now = Date.now();
    reqTimes = reqTimes.filter((t) => now - t < windowMs);
    const rpm = reqTimes.length;
    const errRate = totalInWindow ? +((errCount / totalInWindow) * 100).toFixed(2) : 0;
    reqSeries.push(rpm); reqSeries.shift();
    errSeries.push(errRate); errSeries.shift();
    latSeries.push(p95(latencies)); latSeries.shift();
    cpuSeries.push(cpuPct()); cpuSeries.shift();
    errCount = 0; totalInWindow = 0; latencies = [];
  }, windowMs).unref?.();

  // per-request instrumentation
  function middleware(req, res, next) {
    if (req.path === path) return serve(req, res);
    const start = process.hrtime.bigint();
    totalInWindow++;
    apiCalls24h++;
    reqTimes.push(Date.now());
    res.on("finish", () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      latencies.push(ms);
      if (res.statusCode >= 500) errCount++;
    });
    next();
  }

  async function serve(req, res) {
    const now = Date.now();
    const recent = reqTimes.filter((t) => now - t < windowMs);
    const errRate = totalInWindow ? +((errCount / totalInWindow) * 100).toFixed(2) : (errSeries[errSeries.length - 1] || 0);
    const status =
      errRate >= 5 ? "critical" :
      errRate >= 1 || cpuPct() >= 85 ? "warning" : "healthy";

    let errors = [], feedback = [], deploys = [];
    try { if (opts.collectErrors) errors = (await opts.collectErrors()) || []; } catch (e) {}
    try { if (opts.collectFeedback) feedback = (await opts.collectFeedback()) || []; } catch (e) {}
    try { if (opts.collectDeploys) deploys = (await opts.collectDeploys()) || []; } catch (e) {}

    res.json({
      schema: "watchdocs/telemetry@1",
      service: svc,
      health: {
        status,
        score: Math.max(0, 100 - Math.round(errRate * 8) - Math.max(0, cpuPct() - 70)),
        uptime: opts.uptime != null ? opts.uptime : 100,
        uptime30: opts.uptime30 != null ? opts.uptime30 : 100,
      },
      metrics: {
        reqPerMin: recent.length,
        apiCalls24h,
        errorRate: errRate,
        latencyP95: p95(latencies) || latSeries[latSeries.length - 1] || 0,
        activeUsers: opts.activeUsers ? opts.activeUsers() : 0,
        cpu: cpuPct(), mem: memPct(),
        disk: opts.disk != null ? opts.disk : 0,
        net: opts.net != null ? opts.net : 0,
      },
      series: { req: reqSeries.slice(), err: errSeries.slice(), lat: latSeries.slice(), cpu: cpuSeries.slice() },
      errors, feedback, deploys,
    });
  }

  return middleware;
}

module.exports = { watchdocsAgent };
