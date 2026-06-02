# watchDocs Agent — 서비스 붙이기

대시보드에 새 서비스를 올리는 핵심은 **표준 `GET /telemetry` 응답 한 가지**입니다. 전체 스키마는 [`../API.md`](../API.md) 참고.

## Node / Express — 미들웨어 한 줄

```js
const express = require("express");
const { watchdocsAgent } = require("./watchdocs-agent");

const app = express();

app.use(watchdocsAgent({
  service: {
    id: "media-cdn",                 // registry.json의 id와 동일해야 함
    title: "Media CDN",
    repo: "watchdocs/media-cdn",
    lang: "JavaScript",
    version: process.env.APP_VERSION,
  },
  // 사용자 애로사항 = GitHub 이슈 (선택)
  collectFeedback: async () => {
    const r = await fetch("https://api.github.com/repos/watchdocs/media-cdn/issues?state=open&per_page=10", {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
    });
    const issues = await r.json();
    return issues.filter(i => !i.pull_request).map(i => ({
      type: "issue",
      sev: i.labels.some(l => l.name === "critical") ? "high" : "med",
      title: i.title,
      author: i.user.login,
      channel: `GitHub #${i.number}`,
      up: i.reactions ? i.reactions.total_count : 0,
      time: new Date(i.created_at).getTime(),
      tag: (i.labels[0] && i.labels[0].name) || "bug",
    }));
  },
  // 배포/커밋 = GitHub commits (선택)
  collectDeploys: async () => {
    const r = await fetch("https://api.github.com/repos/watchdocs/media-cdn/commits?per_page=5", {
      headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` },
    });
    const commits = await r.json();
    return commits.map(c => ({
      kind: "commit", sha: c.sha.slice(0, 7), msg: c.commit.message.split("\n")[0],
      author: c.commit.author.name, time: new Date(c.commit.author.date).getTime(), state: "ok",
    }));
  },
}));

app.listen(8080);
```

미들웨어가 자동으로 측정하는 값: **요청수(req/min), 에러율(5xx 비율), 지연 P95, CPU/메모리**.
`disk`, `net`, `activeUsers` 는 환경마다 달라 옵션으로 주입하세요 (`disk`, `net`, `activeUsers: () => n`).

## 다른 언어 (Go, Python, Rust, Java…)

미들웨어가 없어도 됩니다. `GET /telemetry` 가 **API.md의 JSON을 그대로 반환**하면 끝입니다. 핵심 필수값은 `service.id` 와 `health.status` 둘 뿐이고, 나머지는 채울 수 있는 만큼만 채우면 됩니다.

## 등록

`server/registry.json` 에 한 줄 추가하고 수집기를 재시작(또는 `POST /admin/reload`):

```json
{ "id": "media-cdn", "repo": "watchdocs/media-cdn", "telemetryUrl": "http://media-cdn:8080/telemetry", "demo": false }
```

## Push 방식 (워커/배치/람다 등 상시 떠있지 않은 서비스)

엔드포인트를 못 여는 서비스는 같은 JSON을 수집기로 보냅니다:

```js
await fetch("http://collector:4000/ingest/my-worker", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(contract),   // API.md 형식
});
```

처음 보는 id는 자동 등록되어 카드에 나타납니다.
