/* watchDocs — app shell, top bar, live tick, tweaks. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#34d399",
  "density": "regular",
  "scanlines": true,
  "liveData": true,
  "panelStyle": "outline"
}/*EDITMODE-END*/;

const ACCENTS = {
  "#34d399": { name: "Emerald", ok: "152 65% 52%" },
  "#38bdf8": { name: "Sky", ok: "199 88% 60%" },
  "#a78bfa": { name: "Violet", ok: "256 90% 76%" },
  "#fbbf24": { name: "Amber", ok: "43 96% 56%" },
};

// jitter a value toward realistic bounds
function jit(v, amt, lo, hi) {
  let n = v + (Math.random() - 0.5) * amt;
  return Math.max(lo, Math.min(hi, n));
}

function SourceBadge({ live }) {
  return (
    <div className="wd-source wd-mono" title={live ? "Collector API에 연결됨" : "수집기 미연결 — 목업 데이터"}>
      <span className={"wd-source-dot" + (live ? " is-api" : "")} />
      {live ? "API" : "MOCK"}
    </div>
  );
}

function TopBar({ services, view, onHome, clock, connected, dataLive }) {
  const counts = { critical: 0, warning: 0, healthy: 0 };
  services.forEach((s) => {
    if (s.status === "critical") counts.critical++;
    else if (s.status === "warning" || s.status === "degraded") counts.warning++;
    else counts.healthy++;
  });
  return (
    <header className="wd-topbar">
      <div className="wd-brand" onClick={onHome} role="button">
        <span className="wd-brand-mark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M2 12h3M19 12h3" /><path d="M12 2v3M12 19v3" />
            <path d="M4.5 12a7.5 7.5 0 0 0 15 0" opacity="0.5" />
          </svg>
        </span>
        <div className="wd-brand-txt">
          <span className="wd-brand-name">watch<span className="wd-brand-accent">Docs</span></span>
          <span className="wd-brand-sub wd-mono">SERVICE CONTROL</span>
        </div>
      </div>

      <nav className="wd-breadcrumb wd-mono">
        <button className={"wd-crumb" + (view === "grid" ? " is-active" : "")} onClick={onHome}>~/ services</button>
        {view === "detail" && <><span className="wd-crumb-sep">/</span><span className="wd-crumb is-active">detail</span></>}
      </nav>

      <div className="wd-topbar-right">
        <SourceBadge live={dataLive} />
        <div className="wd-fleet wd-mono">
          <span className="wd-fleet-item"><StatusDot status="healthy" size={7} />{counts.healthy}</span>
          <span className="wd-fleet-item"><StatusDot status="warning" size={7} />{counts.warning}</span>
          <span className="wd-fleet-item"><StatusDot status="critical" size={7} pulse={counts.critical > 0} />{counts.critical}</span>
        </div>
        <div className="wd-conn wd-mono">
          <span className={"wd-conn-dot" + (connected ? " is-live" : "")} />
          {connected ? "LIVE" : "PAUSED"}
        </div>
        <div className="wd-clock wd-mono">{clock}</div>
      </div>
    </header>
  );
}

function BootScreen() {
  return (
    <div className="wd-boot">
      <div className="wd-boot-mark">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3" /><path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
          <path d="M4.5 12a7.5 7.5 0 0 0 15 0" opacity="0.5" />
        </svg>
      </div>
      <div className="wd-boot-txt wd-mono">telemetry 수집 중<span className="wd-boot-dots">...</span></div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [data, setData] = React.useState(null);

  // pull unified snapshot from collector (falls back to mock in api.js)
  React.useEffect(() => {
    let alive = true;
    const pull = () => window.WD_loadSnapshot().then((d) => { if (alive && d) setData(d); });
    pull();
    const id = setInterval(pull, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const [view, setView] = React.useState("grid");
  const [selected, setSelected] = React.useState(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("all");
  const [clock, setClock] = React.useState(clockStr(new Date()));

  // live per-service derived metrics
  const svc = data ? data.services.find((s) => s.id === selected) : null;
  const [live, setLive] = React.useState(null);

  React.useEffect(() => {
    if (!svc) { setLive(null); return; }
    setLive({ cpu: svc.cpu, mem: svc.mem, net: svc.net, req: svc.reqPerMin, lat: svc.latencyP95, err: svc.errorRate, users: svc.activeUsers });
  }, [selected]);

  // ticking clock + metric jitter
  React.useEffect(() => {
    const id = setInterval(() => {
      setClock(clockStr(new Date()));
      if (t.liveData && svc) {
        setLive((p) => {
          if (!p) return p;
          return {
            cpu: jit(p.cpu, 5, Math.max(8, svc.cpu - 12), Math.min(99, svc.cpu + 8)),
            mem: jit(p.mem, 3, Math.max(8, svc.mem - 8), Math.min(98, svc.mem + 6)),
            net: jit(p.net, 7, 10, 95),
            req: jit(p.req, svc.reqPerMin * 0.06, svc.reqPerMin * 0.8, svc.reqPerMin * 1.2),
            lat: jit(p.lat, svc.latencyP95 * 0.08, svc.latencyP95 * 0.7, svc.latencyP95 * 1.4),
            err: jit(p.err, svc.errorRate * 0.12 + 0.02, Math.max(0, svc.errorRate * 0.6), svc.errorRate * 1.5),
            users: Math.round(jit(p.users, Math.max(10, svc.activeUsers * 0.02), svc.activeUsers * 0.9, svc.activeUsers * 1.1)),
          };
        });
      }
    }, 1100);
    return () => clearInterval(id);
  }, [svc, t.liveData]);

  const openService = (id) => { setSelected(id); setView("detail"); window.scrollTo(0, 0); };
  const goHome = () => { setView("grid"); };

  // apply accent + density to :root
  React.useEffect(() => {
    const root = document.documentElement;
    const a = ACCENTS[t.accent] || ACCENTS["#34d399"];
    root.style.setProperty("--ok-h", a.ok);
    root.dataset.density = t.density;
    root.dataset.scanlines = t.scanlines ? "on" : "off";
    root.dataset.panel = t.panelStyle;
  }, [t.accent, t.density, t.scanlines, t.panelStyle]);

  if (!data) return <BootScreen />;

  return (
    <div className="wd-app">
      <TopBar services={data.services} view={view} onHome={goHome} clock={clock} connected={t.liveData} dataLive={!!data.__live} />
      <main className="wd-main">
        {view === "grid" ? (
          <ServiceGrid services={data.services} onOpen={openService} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
        ) : (
          svc && live && <DetailView svc={svc} data={data} onBack={goHome} live={live} />
        )}
      </main>

      <TweaksPanel>
        <TweakSection label="테마" />
        <TweakColor label="액센트" value={t.accent} options={Object.keys(ACCENTS)} onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="패널 스타일" value={t.panelStyle} options={["outline", "filled"]} onChange={(v) => setTweak("panelStyle", v)} />
        <TweakSection label="레이아웃" />
        <TweakRadio label="밀도" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="콘솔 효과" />
        <TweakToggle label="스캔라인 텍스처" value={t.scanlines} onChange={(v) => setTweak("scanlines", v)} />
        <TweakToggle label="실시간 데이터" value={t.liveData} onChange={(v) => setTweak("liveData", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
