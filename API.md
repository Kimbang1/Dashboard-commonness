# watchDocs — 통일 Telemetry API 계약 (v1)

대시보드는 서비스의 언어/프레임워크를 모릅니다. **모든 서비스가 아래 한 가지 형식만 지키면** 카드 그리드에 자동으로 나타나고 상세 관제가 동작합니다.

서비스가 표준을 따르는 방법은 두 가지 — 둘 중 하나만 구현하면 됩니다.

| 방식 | 서비스가 하는 일 | 적합한 경우 |
|------|------------------|-------------|
| **Pull (권장)** | `GET /telemetry` 엔드포인트를 노출 | 상시 떠 있는 웹서비스 |
| **Push** | 수집기로 같은 JSON을 `POST /ingest/:id` | 배치/워커/람다 등 |

수집기(Collector)는 등록된 서비스를 주기적으로 폴링(pull)하거나 들어온 push를 받아서, 대시보드가 읽는 `/api/snapshot` 하나로 합칩니다.

---

## 1. 서비스가 내보내는 신호 — `GET /telemetry`

`Content-Type: application/json`. 모든 필드는 아래 타입을 따릅니다. **`service.id`, `health.status` 만 필수**, 나머지는 없으면 0/빈 배열로 처리됩니다.

```jsonc
{
  "schema": "watchdocs/telemetry@1",        // 버전 고정용
  "service": {
    "id":        "media-cdn",               // (필수) 고유 ID. registry의 id와 일치
    "name":      "media-cdn",
    "title":     "Media CDN",
    "repo":      "watchdocs/media-cdn",      // GitHub owner/repo
    "lang":      "Go",
    "langColor": "#00ADD8",                  // 카드 언어 점 색 (선택)
    "env":       "production",
    "region":    "ap-northeast-2",
    "version":   "v2.14.0",
    "versionState": "deployed"               // deployed | deploying | rolling-back
  },

  "health": {
    "status":   "healthy",                   // (필수) healthy | warning | degraded | critical
    "score":    98,                          // 0–100 종합 헬스
    "uptime":   99.99,                        // 최근(예: 24h) 가동률 %
    "uptime30": 99.98                         // 30일 가동률 %
  },

  "metrics": {
    "reqPerMin":   18420,
    "apiCalls24h": 24800000,
    "errorRate":   4.8,                       // %
    "latencyP95":  812,                       // ms
    "activeUsers": 9120,
    "cpu": 91, "mem": 86, "disk": 73, "net": 64   // % (0–100)
  },

  // 최근 N개 시계열(차트/스파크라인용). 길이는 자유(48 권장).
  "series": {
    "req": [16000, 16240, ...],
    "err": [0.8, 0.9, ...],
    "lat": [300, 310, ...],
    "cpu": [60, 62, ...]
  },

  // 활성 에러/장애. count 내림차순으로 보여집니다.
  "errors": [
    {
      "sev":      "critical",                // critical | warning | info
      "code":     "ECONNRESET",
      "title":    "Upstream origin connection reset",
      "count":    1284,
      "delta":    "+1180",                   // 문자열. "new" / "+12" / "-3"
      "lastSeen": 1717200000000,             // epoch ms
      "endpoint": "GET /assets/:id",
      "trace":    "net/http: TLS handshake timeout\n  at ..."
    }
  ],

  // 사용자 애로사항(VOC) — GitHub 이슈, 인앱 피드백, 스토어 리뷰 등
  "feedback": [
    {
      "type":    "issue",                    // issue | feedback
      "sev":     "high",                     // high | med | low
      "title":   "이미지가 간헐적으로 깨져서 로드돼요",
      "author":  "minseo_k",
      "channel": "GitHub #482",
      "up":      34,                          // 투표/공감 수
      "time":    1717200000000,
      "tag":     "bug"                        // bug|performance|ui|request|feature|a11y
    }
  ],

  // 배포/커밋 타임라인
  "deploys": [
    {
      "kind":   "deploy",                    // deploy | rollback | commit
      "sha":    "7e2d11b",
      "msg":    "feat: switch origin pool to adaptive sizing",
      "author": "minseo_k",
      "time":   1717200000000,
      "state":  "failed"                     // ok | failed | in-progress
    }
  ]
}
```

### 어디서 값을 채우나
- `metrics`, `series` → 앱 내부 카운터 / Prometheus / OS 지표
- `errors` → 로그 집계(Sentry, 자체 로거)에서 상위 N개
- `feedback` → **GitHub Issues API** + 인앱 피드백/스토어 리뷰
- `deploys` → **GitHub commits/deployments API** 또는 CI

> Node/Express 서비스는 `agent/express-agent.js` 를 `app.use()` 한 줄로 끝납니다. 다른 언어는 위 JSON만 그대로 반환하면 됩니다.

---

## 2. 서비스 등록 — `server/registry.json`

"GitHub에 등록한 서비스 목록"이 여기 있습니다. 수집기는 이 목록만 폴링합니다.

```jsonc
[
  {
    "id": "media-cdn",
    "repo": "watchdocs/media-cdn",
    "telemetryUrl": "http://media-cdn.internal:8080/telemetry",
    "demo": false
  }
]
```
- `telemetryUrl` 있으면 pull, 없거나 `demo:true` 면 수집기가 데모 신호를 합성(컨테이너만 띄워도 동작).

---

## 3. 대시보드가 읽는 API (수집기가 제공)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/snapshot` | 전체 서비스 합본(대시보드 메인). 카드+상세 한 번에 |
| `GET` | `/api/services` | 서비스 요약 배열 |
| `GET` | `/api/services/:id` | 단일 서비스 상세 |
| `POST`| `/ingest/:id` | (push 방식) 서비스가 telemetry를 직접 전송 |
| `GET` | `/healthz` | 수집기 자체 헬스 |

`/api/snapshot` 응답은 대시보드 내부 형식과 1:1 입니다:
```jsonc
{ "services": [ {…요약+시계열…} ], "errors": {id:[…]}, "feedback": {id:[…]}, "deploys": {id:[…]}, "generatedAt": 1717200000000 }
```

---

## 4. 새 서비스를 붙이는 절차
1. 서비스에 `GET /telemetry` 추가 (Node면 agent 미들웨어, 그 외 언어는 위 JSON 반환)
2. `server/registry.json` 에 `{ id, repo, telemetryUrl }` 한 줄 추가
3. 끝. 다음 폴링(기본 5초)부터 카드에 자동 등장
