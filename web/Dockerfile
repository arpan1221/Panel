# Panel web — Next.js 14 dev server.
# Dev-mode only for now (fast iteration); swap to multi-stage prod build Sunday.
# Build from the repo root: `docker build -f web/Dockerfile -t panel-web ./web`
FROM node:20-alpine

WORKDIR /app

# Copy manifests first for layer caching.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

EXPOSE 3100

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3100/ >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "dev"]
