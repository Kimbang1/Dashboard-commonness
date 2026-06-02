/* watchDocs — shared primitives, charts, formatters. Exports to window. */

// ---------- formatters ------------------------------------------------------
function fmtNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
  return String(Math.round(n));
}
function fmtInt(n) {
  return Math.round(n).toLocaleString("en-US");
}
function timeAgo(t) {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return s + "초 전";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "분 전";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "시간 전";
  return Math.floor(h / 24) + "일 전";
}
function clockStr(d) {
  const p = (x) => String(x).padStart(2, "0");
  return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

const STATUS = {
  healthy: { label: "HEALTHY", color: "var(--ok)", dim: "var(--ok-dim)" },
  warning: { label: "WARNING", color: "var(--warn)", dim: "var(--warn-dim)" },
  degraded: { label: "DEGRADED", color: "var(--warn)", dim: "var(--warn-dim)" },
  critical: { label: "CRITICAL", color: "var(--crit)", dim: "var(--crit-dim)" },
};
const SEV = {
  critical: "var(--crit)", high: "var(--crit)",
  warning: "var(--warn)", med: "var(--warn)",
  info: "var(--info)", low: "var(--text-faint)",
};

// ---------- status dot ------------------------------------------------------
function StatusDot({ status, size = 8, pulse }) {
  const c = (STATUS[status] || STATUS.healthy).color;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      {pulse && (
        <span className="wd-ping" style={{ background: c, width: size, height: size }} />
      )}
      <span style={{ width: size, height: size, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}`, position: "relative" }} />
    </span>
  );
}

// ---------- sparkline -------------------------------------------------------
function Sparkline({ data, w = 120, h = 34, color = "var(--ok)", fill = true, strokeW = 1.5 }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${w} ${h} L 0 ${h} Z`;
  const gid = "sg" + Math.random().toString(36).slice(2, 8);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------- area chart with grid (bigger) -----------------------------------
function AreaChart({ data, w = 520, h = 150, color = "var(--ok)", unit = "", label }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pad = { l: 0, r: 0, t: 10, b: 0 };
  const iw = w, ih = h - pad.t;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * iw;
    const y = pad.t + (ih - 2) - ((v - min) / range) * (ih - 8);
    return [x, y];
  });
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${iw} ${h} L 0 ${h} Z`;
  const gid = "ac" + Math.random().toString(36).slice(2, 8);
  const last = pts[pts.length - 1];
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2={w} y1={pad.t + ih * g} y2={pad.t + ih * g} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 4" />
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="6" fill={color} opacity="0.25" />
    </svg>
  );
}

// ---------- load bar (cpu/mem/disk) -----------------------------------------
function LoadBar({ label, value, sub }) {
  const color = value >= 85 ? "var(--crit)" : value >= 70 ? "var(--warn)" : "var(--ok)";
  return (
    <div className="wd-load">
      <div className="wd-load-top">
        <span className="wd-load-label">{label}</span>
        <span className="wd-mono wd-load-val" style={{ color }}>{Math.round(value)}<span className="wd-load-pct">%</span></span>
      </div>
      <div className="wd-load-track">
        <div className="wd-load-fill" style={{ width: value + "%", background: color, boxShadow: `0 0 10px ${color}66` }} />
        <div className="wd-load-ticks" />
      </div>
      {sub && <div className="wd-load-sub wd-mono">{sub}</div>}
    </div>
  );
}

// ---------- radial health ring ----------------------------------------------
function HealthRing({ value, status, size = 116 }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - value / 100);
  const col = (STATUS[status] || STATUS.healthy).color;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth="8"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease", filter: `drop-shadow(0 0 6px ${col}88)` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="wd-mono" style={{ fontSize: 30, fontWeight: 600, color: col, lineHeight: 1 }}>{Math.round(value)}</div>
        <div className="wd-label" style={{ marginTop: 4, fontSize: 9.5 }}>HEALTH</div>
      </div>
    </div>
  );
}

// ---------- panel shell -----------------------------------------------------
function Panel({ title, icon, right, children, className = "", pad = true, accent }) {
  return (
    <section className={"wd-panel " + className} style={accent ? { borderTopColor: accent } : null}>
      {title && (
        <header className="wd-panel-head">
          <div className="wd-panel-title">
            {icon && <span className="wd-panel-icon">{icon}</span>}
            <span>{title}</span>
          </div>
          {right && <div className="wd-panel-right">{right}</div>}
        </header>
      )}
      <div className={pad ? "wd-panel-body" : ""}>{children}</div>
    </section>
  );
}

// ---------- pill ------------------------------------------------------------
function Pill({ children, color = "var(--text-dim)", bg, border = true }) {
  return (
    <span className="wd-pill wd-mono" style={{ color, background: bg || "transparent", borderColor: border ? "currentColor" : "transparent" }}>
      {children}
    </span>
  );
}

// ---------- spark KPI -------------------------------------------------------
function Kpi({ label, value, unit, delta, deltaGood, spark, sparkColor, status }) {
  const dColor = delta == null ? "var(--text-faint)" : deltaGood ? "var(--ok)" : "var(--crit)";
  return (
    <div className="wd-kpi">
      <div className="wd-kpi-label wd-label">{label}</div>
      <div className="wd-kpi-row">
        <div className="wd-kpi-value wd-mono">{value}{unit && <span className="wd-kpi-unit">{unit}</span>}</div>
        {spark && <div className="wd-kpi-spark"><Sparkline data={spark} w={72} h={26} color={sparkColor || "var(--ok)"} /></div>}
      </div>
      {delta != null && <div className="wd-kpi-delta wd-mono" style={{ color: dColor }}>{delta}</div>}
    </div>
  );
}

Object.assign(window, {
  fmtNum, fmtInt, timeAgo, clockStr, STATUS, SEV,
  StatusDot, Sparkline, AreaChart, LoadBar, HealthRing, Panel, Pill, Kpi,
});
