# watchDocs Dashboard 사용 방법

이 문서는 GitHub에 올려둔 프로젝트를 새 PC나 배포 서버에서 가져와 실행하고, 이후 최신 코드로 갱신하는 방법을 정리한 파일입니다.

## 1. 처음 가져오기

배포할 서버나 새 PC에서 아래 명령을 실행합니다.

```bash
git clone https://github.com/Kimbang1/Dashboard-commonness.git
cd Dashboard-commonness
```

서비스 등록 목록은 로컬 전용 파일입니다. 처음 받은 환경에서 파일이 없다면 예시 파일을 복사해서 만듭니다.

```powershell
Copy-Item server/registry.example.json server/registry.json
```

## 2. Docker로 실행하기

Docker와 Docker Compose가 설치되어 있어야 합니다.

```bash
docker compose up --build -d
```

실행 후 확인 주소:

```text
대시보드: http://localhost:8080
Collector 상태: http://localhost:4000/healthz
```

다른 PC에서 서버에 접속할 때는 `localhost` 대신 서버 IP나 도메인을 사용합니다.

```text
대시보드: http://서버IP:8080
Collector 상태: http://서버IP:4000/healthz
```

외부 접속이 안 되면 서버 방화벽, 공유기 포트포워딩, 클라우드 보안 그룹에서 `8080` 포트가 열려 있는지 확인합니다. Collector 상태까지 외부에서 확인하려면 `4000` 포트도 열어야 합니다.

## 3. 실행 상태 확인

컨테이너 상태 확인:

```bash
docker compose ps
```

로그 확인:

```bash
docker compose logs -f
```

대시보드 로그만 확인:

```bash
docker compose logs -f dashboard
```

Collector 로그만 확인:

```bash
docker compose logs -f collector
```

## 4. 중지와 재시작

중지:

```bash
docker compose down
```

다시 시작:

```bash
docker compose up -d
```

이미지를 다시 빌드하면서 시작:

```bash
docker compose up --build -d
```

## 5. 최신 코드 가져와서 다시 배포하기

이미 서버에 프로젝트를 받아둔 상태라면 아래 명령으로 최신 코드를 가져옵니다.

```bash
cd Dashboard-commonness
git pull origin main
docker compose up --build -d
```

업데이트 후 상태 확인:

```bash
docker compose ps
```

## 6. 현재 PC에서 GitHub로 다시 올리기

파일을 수정한 뒤 GitHub에 반영하려면 현재 프로젝트 폴더에서 실행합니다.

```bash
git status
git add .
git commit -m "Update project"
git push origin main
```

커밋할 변경사항이 없으면 `git commit`은 실행하지 않아도 됩니다.

## 7. 로컬에서 빠르게 확인하기

현재 프로젝트 폴더에서 바로 실행:

```bash
docker compose up --build -d
```

브라우저에서 확인:

```text
http://localhost:8080
```

Collector 상태 확인:

```text
http://localhost:4000/healthz
```

## 8. WatchDocs 프로젝트 연결하기

WatchDocs 프로젝트가 `/telemetry` API를 제공하도록 수정되어 있다면, 이 대시보드는 Collector가 그 주소를 읽어서 카드를 표시합니다.

현재 대시보드에는 아래 주소로 WatchDocs가 등록되어 있습니다.

```text
http://host.docker.internal:8001/telemetry
```

이 주소는 Docker 컨테이너 안에서 로컬 PC의 WatchDocs FastAPI 백엔드를 읽을 때 사용하는 주소입니다. `8000`번에 기존 서버가 떠 있어서 `/telemetry`가 404를 내면, 충돌을 피해서 `8001`번으로 실행합니다.

### 8-1. WatchDocs 백엔드 먼저 실행

WatchDocs 프로젝트 폴더에서 백엔드를 실행합니다. 대시보드 origin을 허용하려면 백엔드 실행 전에 PowerShell에서 환경변수를 지정합니다.

```powershell
$env:WATCHDOCS_CORS_ORIGINS="http://localhost:8080,http://127.0.0.1:8080"
```

그다음 WatchDocs 백엔드를 실행합니다. 프로젝트의 실제 실행 명령을 사용하면 됩니다.

```powershell
cd C:\경로\watchDocs
# 예: FastAPI 실행 명령
uvicorn main:app --host 127.0.0.1 --port 8001
```

실행 후 호스트에서 직접 확인:

```powershell
curl http://localhost:8001/telemetry
```

JSON이 응답되면 WatchDocs 쪽 준비는 완료입니다.

### 8-2. 대시보드 실행

대시보드 프로젝트 폴더에서 실행합니다.

```powershell
cd C:\Users\kimbang\Desktop\dev\watchDocs_Dashboard
docker compose up --build -d
```

브라우저에서 확인:

```text
http://localhost:8080
```

### 8-3. 대시보드에서 WatchDocs가 안 보일 때

Collector 로그를 확인합니다.

```powershell
docker compose logs -f collector
```

WatchDocs 백엔드가 켜져 있는지 확인합니다.

```powershell
curl http://localhost:8001/telemetry
```

Docker 컨테이너 안에서 로컬 백엔드에 접근해야 하므로 `server/registry.json`의 URL은 아래처럼 되어 있어야 합니다.

```json
"telemetryUrl": "http://host.docker.internal:8001/telemetry"
```

`server/registry.json`을 수정했다면 collector가 다시 읽도록 reload를 호출합니다.

```powershell
curl -X POST http://localhost:4000/admin/reload
```

### 8-4. 상황별 telemetry URL

로컬 PC에서 Docker 대시보드가 로컬 WatchDocs 백엔드를 읽는 경우:

```text
http://host.docker.internal:8000/telemetry
```

8000번에 기존 서버가 떠 있어 404가 나면 현재 로컬 설정처럼 8001번을 씁니다.

```text
http://host.docker.internal:8001/telemetry
```

호스트 브라우저나 PowerShell에서 직접 확인하는 경우:

```text
http://localhost:8000/telemetry
```

8001번으로 실행했다면:

```text
http://localhost:8001/telemetry
```

WatchDocs 백엔드와 대시보드가 같은 `docker compose` 네트워크 안에 있는 경우:

```text
http://<watchdocs-backend-service-name>:8000/telemetry
```

## 9. 대시보드에서 안 쓰는 서비스 삭제하기

대시보드 카드 우측 상단의 삭제 버튼을 누르면 확인 창이 뜹니다. `Delete`를 누르면 해당 서비스가 collector registry에서 제거되고 대시보드 목록에서도 바로 사라집니다.

삭제 결과는 아래 파일에 반영됩니다.

```text
server/registry.json
```

Docker 실행 시 이 파일은 collector 컨테이너의 `/app/registry.json`에 연결되어 있으므로, 삭제 후 컨테이너를 재시작하거나 다시 빌드해도 제거된 서비스가 다시 나타나지 않습니다.

`server/registry.json`은 로컬 전용 파일입니다. 등록한 서비스 목록이나 삭제 내역은 GitHub에 올리지 않습니다.

GitHub에는 기능 코드와 예시 파일만 올립니다.

```powershell
git status
git add .gitignore docker-compose.yml server/Dockerfile server/registry.example.json
git commit -m "Keep service registry local"
git push origin main
```

삭제 API를 직접 호출해야 할 때:

```powershell
curl -X DELETE http://localhost:4000/api/services/<service-id>
```

예를 들어 대시보드에 표시된 서비스 ID가 `watchdocs-api`라면:

```powershell
curl -X DELETE http://localhost:4000/api/services/watchdocs-api
```

## 10. 자주 생기는 문제

### 포트가 이미 사용 중일 때

`8080` 또는 `4000` 포트가 이미 사용 중이면 `docker-compose.yml`의 왼쪽 포트 번호를 바꿉니다.

예시:

```yaml
ports:
  - "8081:80"
```

이 경우 접속 주소는 `http://localhost:8081`이 됩니다.

### 최신 코드가 반영되지 않을 때

다시 빌드해서 실행합니다.

```bash
docker compose up --build -d
```

그래도 안 되면 컨테이너를 내렸다가 다시 시작합니다.

```bash
docker compose down
docker compose up --build -d
```

### GitHub에서 가져오기 실패

원격 주소를 확인합니다.

```bash
git remote -v
```

현재 원격 저장소 주소:

```text
https://github.com/Kimbang1/Dashboard-commonness.git
```
