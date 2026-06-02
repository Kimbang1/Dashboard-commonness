# watchDocs Dashboard 사용 방법

이 문서는 GitHub에 올려둔 프로젝트를 새 PC나 배포 서버에서 가져와 실행하고, 이후 최신 코드로 갱신하는 방법을 정리한 파일입니다.

## 1. 처음 가져오기

배포할 서버나 새 PC에서 아래 명령을 실행합니다.

```bash
git clone https://github.com/Kimbang1/Dashboard-commonness.git
cd Dashboard-commonness
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

## 8. 자주 생기는 문제

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
