# watchDocs — Docker 실행

## 한 번에 띄우기 (수집기 + 대시보드)

```bash
docker compose up --build
```

- 대시보드: **http://localhost:8080**
- 수집기 API: **http://localhost:4000/healthz**

`registry.json` 의 서비스가 전부 `demo:true` 라서 외부 서비스 없이도 **실시간으로 움직이는 데이터**가 보입니다. 상단 우측 배지가 `API` 면 수집기 연결됨, `MOCK` 이면 폴백(수집기 미연결) 상태입니다.

## 실제 서비스 붙이기

1. 서비스에 표준 `GET /telemetry` 추가 → [`agent/README.md`](agent/README.md)
2. `server/registry.json` 수정:
   ```json
   { "id": "media-cdn", "repo": "watchdocs/media-cdn",
     "telemetryUrl": "http://media-cdn:8080/telemetry", "demo": false }
   ```
3. 재시작 또는 핫리로드:
   ```bash
   curl -X POST http://localhost:4000/admin/reload
   ```

> 같은 도커 네트워크 안에 서비스 컨테이너가 있다면 `telemetryUrl` 에 서비스명을 그대로 쓰면 됩니다(예: `http://media-cdn:8080/telemetry`).

## 대시보드만 띄우기 (수집기 없이)

```bash
docker build -t watchdocs-dashboard .
docker run -p 8080:80 watchdocs-dashboard
```
`/api` 가 502가 되면 대시보드는 자동으로 번들된 목업으로 폴백합니다.

## 구성 요약

| 컨테이너 | 역할 | 포트 |
|----------|------|------|
| `dashboard` | nginx 정적 서빙 + `/api`·`/ingest` → collector 프록시 | 8080 → 80 |
| `collector` | 등록 서비스 폴링/수집, 통일 API 제공 | 4000 |

| 환경변수 (collector) | 기본값 | 설명 |
|----------------------|--------|------|
| `POLL_MS` | 5000 | 서비스 폴링 주기(ms) |
| `FETCH_TIMEOUT_MS` | 3000 | telemetry fetch 타임아웃 |
| `REGISTRY_PATH` | ./registry.json | 서비스 레지스트리 경로 |

자세한 API 계약은 [`API.md`](API.md).
