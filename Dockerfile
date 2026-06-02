# watchDocs Dashboard — static container (nginx)
# JSX는 브라우저에서 Babel이 변환하므로 별도 빌드 단계가 필요 없습니다.
FROM nginx:1.27-alpine

# 대시보드 진입 파일을 index.html 로 복사 (파일명에 공백이 있어 JSON 형식 사용)
COPY ["watchDocs Dashboard.html", "/usr/share/nginx/html/index.html"]

# 앱이 참조하는 로컬 스크립트들
COPY data.js api.js tweaks-panel.jsx components.jsx grid.jsx detail.jsx app.jsx /usr/share/nginx/html/

# nginx 설정 (.jsx MIME 타입 등)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
