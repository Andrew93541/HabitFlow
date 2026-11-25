# Stage 1: Build React Frontend Bundle
FROM node:22-bookworm-slim AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Install & Compile Production Backend Dependencies
FROM node:22-bookworm-slim AS server-deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# Stage 3: Minimal Non-Root Production Runtime
FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
ENV PORT=5001
ENV DB_PATH=/data/habitflow.db
ENV BACKUP_DIR=/data/backups

WORKDIR /app

# Create persistent SQLite volume directory owned by non-root `node` user
RUN mkdir -p /data /data/backups && chown -R node:node /data /app

COPY --chown=node:node --from=server-deps /app/server/node_modules ./server/node_modules
COPY --chown=node:node server/ ./server/
COPY --chown=node:node --from=client-builder /app/client/dist ./client/dist

USER node
WORKDIR /app/server

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5001) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
