/* watchDocs — detail monitoring view. Exports DetailView to window. */

// ---- error / incident feed -------------------------------------------------
function ErrorRow({ e, open, onToggle }) {
  const c = SEV[e.sev] || "var(--text-faint)";
  return (
    <div className={"wd-err" + (open ? " is-open" : "")}>
      <button className="wd-err-head" onClick={onToggle}>
        <span className="wd-err-sev" style={{ background: c, boxShadow: `0 0 8px ${c}88` }} />
        <span className="wd-err-code wd-mono" style={{ color: c, borderColor: c + "55" }}>{e.code}</span>
        <span className="wd-err-title">{e.title}</span>
        <span className="wd-err-ep wd-mono">{e.endpoint}</span>
        <span className="wd-err-count wd-mono">{fmtInt(e.count)}</span>
        <span className={"wd-err-delta wd-mono " + (e.delta === "new" ? "is-new" : e.delta[0] === "+" ? "is-up" : "is-down")}>{e.delta}</span>
        <span className="wd-err-time wd-mono">{timeAgo(e.lastSeen)}</span>
        <svg className="wd-err-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="wd-err-body">
          <div className="wd-err-trace-label wd-label">STACK TRACE</div>
          <pre className="wd-trace wd-mono">{e.trace}</pre>
          <div className="wd-err-actions">
            <button className="wd-btn-sm">로그 보기</button>
            <button className="wd-btn-sm">이슈 생성</button>
            <button className="wd-btn-sm">담당자 지정</button>
            <button className="wd-btn-sm wd-btn-mute">음소거</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorPanel({ errs }) {
  const [open, setOpen] = React.useState(errs[0] ? 0 : -1);
  const total = errs.reduce((a, e) => a + e.count, 0);
  return (
    <Panel
      title="에러 · 장애"
      icon={<Glyph name="alert" />}
      right={<span className="wd-panel-meta wd-mono">{errs.length}종 · {fmtInt(total)}건 / 1h</span>}
      className="wd-span-7"
    >
      <div className="wd-err-list">
        {errs.length ? errs.map((e, i) => (
          <ErrorRow key={i} e={e} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
        )) : <div className="wd-empty wd-mono" style={{ padding: "28px 0" }}>// 활성 에러 없음 — 모든 시스템 정상</div>}
      </div>
    </Panel>
  );
}

// ---- user feedback / VOC ---------------------------------------------------
function FeedbackRow({ f }) {
  const c = SEV[f.sev] || "var(--text-faint)";
  const tagColors = { bug: "var(--crit)", performance: "var(--warn)", ui: "var(--info)", request: "var(--ok)", feature: "var(--info)", a11y: "var(--info)" };
  return (
    <div className="wd-voc">
      <div className="wd-voc-up">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6" /></svg>
        <span className="wd-mono">{f.up}</span>
      </div>
      <div className="wd-voc-main">
        <div className="wd-voc-title">{f.title}</div>
        <div className="wd-voc-meta wd-mono">
          <span className="wd-voc-tag" style={{ color: tagColors[f.tag] || "var(--text-dim)", borderColor: (tagColors[f.tag] || "var(--text-dim)") + "44" }}>{f.tag}</span>
          <span>{f.author}</span>
          <span className="wd-voc-dot">·</span>
          <span>{f.channel}</span>
          <span className="wd-voc-dot">·</span>
          <span>{timeAgo(f.time)}</span>
        </div>
      </div>
      <span className="wd-voc-sev" style={{ background: c }} title={f.sev} />
    </div>
  );
}

function FeedbackPanel({ items }) {
  const [tab, setTab] = React.useState("all");
  const shown = items.filter((f) => tab === "all" || (tab === "issue" ? f.type === "issue" : f.type === "feedback"));
  return (
    <Panel
      title="사용자 애로사항 · VOC"
      icon={<Glyph name="chat" />}
      right={
        <div className="wd-mini-tabs">
          {[["all", "전체"], ["feedback", "피드백"], ["issue", "이슈"]].map(([id, l]) => (
            <button key={id} className={"wd-mini-tab" + (tab === id ? " is-active" : "")} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>
      }
      className="wd-span-5"
    >
      <div className="wd-voc-list">
        {shown.map((f, i) => <FeedbackRow key={i} f={f} />)}
        {!shown.length && <div className="wd-empty wd-mono" style={{ padding: "24px 0" }}>// 항목 없음</div>}
      </div>
    </Panel>
  );
}

// ---- deploy timeline -------------------------------------------------------
function DeployPanel({ deploys, svc }) {
  const kindMeta = {
    deploy: { icon: "rocket", color: "var(--info)" },
    rollback: { icon: "undo", color: "var(--crit)" },
    commit: { icon: "commit", color: "var(--text-faint)" },
  };
  const stateMeta = {
    ok: { label: "성공", color: "var(--ok)" },
    failed: { label: "실패", color: "var(--crit)" },
    "in-progress": { label: "진행중", color: "var(--warn)" },
  };
  return (
    <Panel title="배포 · 커밋" icon={<Glyph name="branch" />} right={<span className="wd-panel-meta wd-mono">{svc.version}</span>} className="wd-span-4">
      <div className="wd-timeline">
        {deploys.map((d, i) => {
          const km = kindMeta[d.kind], sm = stateMeta[d.state];
          return (
            <div className="wd-tl-item" key={i}>
              <div className="wd-tl-rail">
                <span className="wd-tl-node" style={{ borderColor: km.color, color: km.color }}><Glyph name={km.icon} size={11} /></span>
                {i < deploys.length - 1 && <span className="wd-tl-line" />}
              </div>
              <div className="wd-tl-content">
                <div className="wd-tl-msg">{d.msg}</div>
                <div className="wd-tl-meta wd-mono">
                  <span className="wd-tl-sha">{d.sha}</span>
                  <span className="wd-voc-dot">·</span>
                  <span>{d.author}</span>
                  <span className="wd-voc-dot">·</span>
                  <span>{timeAgo(d.time)}</span>
                  {sm && <span className="wd-tl-state" style={{ color: sm.color, borderColor: sm.color + "44" }}>{d.state === "in-progress" && <span className="wd-spin" style={{ borderTopColor: sm.color }} />}{sm.label}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---- server load panel -----------------------------------------------------
function LoadPanel({ svc, live }) {
  return (
    <Panel title="서버 부하" icon={<Glyph name="cpu" />} right={<span className="wd-panel-meta wd-mono">{svc.region}</span>} className="wd-span-4">
      <div className="wd-load-grid">
        <LoadBar label="CPU" value={live.cpu} sub={`8 vCPU · load ${(live.cpu / 100 * 8).toFixed(1)}`} />
        <LoadBar label="메모리" value={live.mem} sub={`${(live.mem / 100 * 16).toFixed(1)} / 16 GB`} />
        <LoadBar label="디스크" value={svc.disk} sub={`${(svc.disk / 100 * 200).toFixed(0)} / 200 GB`} />
        <LoadBar label="네트워크 I/O" value={live.net} sub={`${(live.net / 100 * 1.2).toFixed(2)} Gbps`} />
      </div>
    </Panel>
  );
}

// ---- traffic / api chart panel ---------------------------------------------
function TrafficPanel({ svc, live }) {
  const [metric, setMetric] = React.useState("req");
  const meta = {
    req: { label: "요청/분", data: svc.reqSeries, color: "var(--ok)", unit: "", cur: fmtNum(live.req) },
    lat: { label: "지연시간 P95", data: svc.latSeries, color: "var(--info)", unit: "ms", cur: Math.round(live.lat) + "ms" },
    err: { label: "에러율", data: svc.errSeries, color: "var(--crit)", unit: "%", cur: live.err.toFixed(2) + "%" },
  };
  const m = meta[metric];
  return (
    <Panel
      title="트래픽 · API"
      icon={<Glyph name="pulse" />}
      right={
        <div className="wd-mini-tabs">
          {[["req", "요청"], ["lat", "지연"], ["err", "에러율"]].map(([id, l]) => (
            <button key={id} className={"wd-mini-tab" + (metric === id ? " is-active" : "")} onClick={() => setMetric(id)}>{l}</button>
          ))}
        </div>
      }
      className="wd-span-8"
    >
      <div className="wd-traffic-head">
        <div>
          <div className="wd-traffic-cur wd-mono" style={{ color: m.color }}>{m.cur}</div>
          <div className="wd-label">{m.label} · 최근 4시간</div>
        </div>
        <div className="wd-traffic-legend wd-mono">
          <span>24h API 호출 <b>{fmtNum(svc.apiCalls24h)}</b></span>
          <span>활성 사용자 <b>{fmtInt(live.users)}</b></span>
        </div>
      </div>
      <AreaChart data={m.data} w={760} h={172} color={m.color} unit={m.unit} />
    </Panel>
  );
}

// ---- glyphs ----------------------------------------------------------------
function Glyph({ name, size = 14 }) {
  const p = {
    alert: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
    chat: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>,
    cpu: <><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></>,
    pulse: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
    branch: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="9" r="3" /><path d="M18 12a9 9 0 0 1-9 9M6 9v6" /></>,
    rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /></>,
    undo: <><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></>,
    commit: <><circle cx="12" cy="12" r="3" /><path d="M3 12h6M15 12h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  }[name];
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
}

// ---- detail header ---------------------------------------------------------
function DetailHeader({ svc, onBack, live }) {
  const st = STATUS[svc.status] || STATUS.healthy;
  const vState = {
    deployed: { label: "배포 완료", color: "var(--ok)" },
    deploying: { label: "배포 중", color: "var(--warn)" },
    "rolling-back": { label: "롤백 중", color: "var(--crit)" },
  }[svc.versionState];
  return (
    <div className="wd-detail-head">
      <div className="wd-detail-head-left">
        <button className="wd-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="wd-detail-id">
          <div className="wd-detail-title-row">
            <StatusDot status={svc.status} size={11} pulse={svc.status !== "healthy"} />
            <h1 className="wd-detail-name wd-mono">{svc.name}</h1>
            <span className="wd-detail-status wd-label" style={{ color: st.color, borderColor: st.color + "55", background: st.color + "14" }}>{st.label}</span>
          </div>
          <div className="wd-detail-sub wd-mono">
            <span>{svc.repo}</span>
            <span className="wd-voc-dot">·</span>
            <span className="wd-lang-dot" style={{ background: svc.langColor, display: "inline-block", width: 8, height: 8, borderRadius: "50%" }} />
            <span>{svc.lang}</span>
            <span className="wd-voc-dot">·</span>
            <span>{svc.env}</span>
            <span className="wd-voc-dot">·</span>
            <span>{svc.region}</span>
          </div>
        </div>
      </div>
      <div className="wd-detail-head-right">
        <div className="wd-deploy-badge">
          <span className="wd-label">버전</span>
          <span className="wd-mono wd-deploy-ver">{svc.version}</span>
          <span className="wd-deploy-state" style={{ color: vState.color, borderColor: vState.color + "44" }}>
            {svc.versionState !== "deployed" && <span className="wd-spin" style={{ borderTopColor: vState.color }} />}{vState.label}
          </span>
        </div>
        <button className="wd-btn-action">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.2-8.6" /><path d="M21 3v6h-6" /></svg>
          새로고침
        </button>
      </div>
    </div>
  );
}

// ---- KPI strip -------------------------------------------------------------
function KpiStrip({ svc, live }) {
  return (
    <div className="wd-kpi-strip">
      <Kpi label="UPTIME (30d)" value={svc.uptime30.toFixed(2)} unit="%" delta={svc.uptime30 >= 99.9 ? "SLA 충족" : "SLA 미달"} deltaGood={svc.uptime30 >= 99.9} spark={null} status={svc.status} />
      <Kpi label="API 호출 (24h)" value={fmtNum(svc.apiCalls24h)} delta={"+" + fmtNum(Math.round(svc.apiCalls24h * 0.04)) + " vs 어제"} deltaGood spark={svc.reqSeries} sparkColor="var(--ok)" />
      <Kpi label="에러율 (1h)" value={live.err.toFixed(2)} unit="%" delta={svc.errorRate >= 2 ? "급증 감지" : "안정"} deltaGood={svc.errorRate < 2} spark={svc.errSeries} sparkColor="var(--crit)" />
      <Kpi label="지연 P95" value={Math.round(live.lat)} unit="ms" delta={svc.latencyP95 >= 400 ? "느림" : "정상"} deltaGood={svc.latencyP95 < 400} spark={svc.latSeries} sparkColor="var(--info)" />
      <Kpi label="활성 사용자" value={fmtInt(live.users)} delta="실시간" deltaGood spark={null} />
      <Kpi label="오픈 이슈" value={svc.openIssues} delta={svc.newFeedback + " VOC 신규"} deltaGood={svc.newFeedback === 0} spark={null} />
    </div>
  );
}

// ---- main detail view ------------------------------------------------------
function DetailView({ svc, data, onBack, live }) {
  return (
    <div className="wd-detail">
      <DetailHeader svc={svc} onBack={onBack} live={live} />
      <KpiStrip svc={svc} live={live} />
      <div className="wd-detail-grid">
        <TrafficPanel svc={svc} live={live} />
        <LoadPanel svc={svc} live={live} />
        <ErrorPanel errs={data.errors[svc.id] || []} />
        <FeedbackPanel items={data.feedback[svc.id] || []} />
        <DeployPanel deploys={data.deploys[svc.id] || []} svc={svc} />
      </div>
    </div>
  );
}

Object.assign(window, { DetailView, Glyph });
