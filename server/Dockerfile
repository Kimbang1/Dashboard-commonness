FROM node:20-alpine
WORKDIR /app

# 의존성 먼저 (레이어 캐시)
COPY package.json ./
RUN npm install --omit=dev

# 소스
COPY collector.js synth.js registry.json ./

ENV PORT=4000 POLL_MS=5000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:4000/healthz >/dev/null 2>&1 || exit 1

CMD ["node", "collector.js"]
