/* watchDocs — service selection card grid. Exports ServiceGrid to window. */

function GridStat({ label, value, color }) {
  return (
    <div className="wd-gridstat">
      <div className="wd-gridstat-val wd-mono" style={color ? { color } : null}>{value}</div>
      <div className="wd-gridstat-label wd-label">{label}</div>
    </div>
  );
}

function ServiceCard({ svc, onOpen, onRemove }) {
  const st = STATUS[svc.status] || STATUS.healthy;
  const errColor = svc.errorRate >= 2 ? "var(--crit)" : svc.errorRate >= 0.5 ? "var(--warn)" : "var(--ok)";
  const open = () => onOpen(svc.id);
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const remove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(svc);
  };
  return (
    <div className={"wd-card wd-card--" + svc.status} onClick={open} onKeyDown={handleKey} role="button" tabIndex="0">
      <div className="wd-card-glow" style={{ background: st.color }} />
      <div className="wd-card-head">
        <div className="wd-card-id">
          <StatusDot status={svc.status} size={9} pulse={svc.status !== "healthy"} />
          <span className="wd-card-name wd-mono">{svc.name}</span>
        </div>
        <div className="wd-card-actions">
          <span className="wd-card-status wd-label" style={{ color: st.color }}>{st.label}</span>
          <button className="wd-card-delete" onClick={remove} title="Remove service" aria-label={"Remove " + svc.name}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5M14 11v5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="wd-card-repo wd-mono">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
          <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        <span>{svc.repo}</span>
      </div>

      <div className="wd-card-spark">
        <Sparkline data={svc.reqSeries} w={300} h={40} color={st.color} strokeW={1.5} />
      </div>

      <div className="wd-card-stats">
        <GridStat label="UPTIME" value={svc.uptime.toFixed(2) + "%"} color={svc.uptime >= 99.9 ? "var(--ok)" : "var(--warn)"} />
        <GridStat label="ERR RATE" value={svc.errorRate.toFixed(2) + "%"} color={errColor} />
        <GridStat label="REQ/MIN" value={fmtNum(svc.reqPerMin)} />
        <GridStat label="P95" value={svc.latencyP95 + "ms"} color={svc.latencyP95 >= 400 ? "var(--warn)" : "var(--text)"} />
      </div>

      <div className="wd-card-foot">
        <span className="wd-lang"><span className="wd-lang-dot" style={{ background: svc.langColor }} />{svc.lang}</span>
        <div className="wd-card-foot-right">
          {svc.openIssues > 0 && <span className="wd-chip"><span className="wd-chip-dot" style={{ background: "var(--info)" }} />{svc.openIssues} 이슈</span>}
          {svc.newFeedback > 0 && <span className="wd-chip"><span className="wd-chip-dot" style={{ background: "var(--warn)" }} />{svc.newFeedback} VOC</span>}
        </div>
      </div>
    </div>
  );
}

function ServiceGrid({ services, onOpen, onRemove, query, setQuery, filter, setFilter }) {
  const counts = { all: services.length, critical: 0, warning: 0, healthy: 0 };
  services.forEach((s) => {
    if (s.status === "critical") counts.critical++;
    else if (s.status === "warning" || s.status === "degraded") counts.warning++;
    else counts.healthy++;
  });
  const q = (query || "").toLowerCase();
  const shown = services.filter((s) => {
    const matchQ = !q || s.name.includes(q) || s.repo.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
    const matchF =
      filter === "all" ? true :
      filter === "critical" ? s.status === "critical" :
      filter === "warning" ? s.status === "warning" || s.status === "degraded" :
      s.status === "healthy";
    return matchQ && matchF;
  });

  const tabs = [
    { id: "all", label: "전체", n: counts.all, c: "var(--text)" },
    { id: "critical", label: "위험", n: counts.critical, c: "var(--crit)" },
    { id: "warning", label: "주의", n: counts.warning, c: "var(--warn)" },
    { id: "healthy", label: "정상", n: counts.healthy, c: "var(--ok)" },
  ];

  return (
    <div className="wd-grid-view">
      <div className="wd-grid-toolbar">
        <div className="wd-grid-heading">
          <h1 className="wd-h1">서비스 모니터링</h1>
          <p className="wd-sub">GitHub에 등록된 서비스 {services.length}개 · 카드를 클릭해 상세 관제를 시작하세요</p>
        </div>
        <div className="wd-grid-controls">
          <div className="wd-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="서비스 / 리포지토리 검색" />
          </div>
          <div className="wd-tabs">
            {tabs.map((t) => (
              <button key={t.id} className={"wd-tab" + (filter === t.id ? " is-active" : "")} onClick={() => setFilter(t.id)}>
                {t.label}<span className="wd-tab-n wd-mono" style={{ color: t.c }}>{t.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="wd-cards">
        {shown.map((s) => <ServiceCard key={s.id} svc={s} onOpen={onOpen} onRemove={onRemove} />)}
        {!shown.length && <div className="wd-empty wd-mono">// 일치하는 서비스가 없습니다</div>}
      </div>
    </div>
  );
}

Object.assign(window, { ServiceGrid });
