FROM golang:1.22-alpine AS build

WORKDIR /src/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/webstats

FROM node:22-alpine AS frontend-build

WORKDIR /src/frontend

RUN corepack enable
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM alpine:3.20 AS runtime

RUN apk add --no-cache ca-certificates curl \
    && addgroup -S counter -g 10001 \
    && adduser -S counter -u 10001 -G counter

WORKDIR /app

COPY --from=build /out/webstats /usr/local/bin/webstats
COPY --from=frontend-build /src/frontend/dist ./frontend
COPY static ./static
COPY docs ./docs

RUN mkdir -p /data \
    && chown -R counter:counter /app /data

USER counter

ENV WEBSTATS_BIND=:8080 \
    WEBSTATS_REDIS_URL=redis://redis:6379 \
    WEBSTATS_ARCHIVE_DATABASE=/data/archive.db \
    WEBSTATS_ARCHIVE_MAX_AGE=24h \
    WEBSTATS_STATIC_ROOT=/app/static \
    WEBSTATS_FRONTEND_ROOT=/app/frontend \
    WEBSTATS_TRACKING_SCRIPT_ROOT=/app/docs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

CMD ["webstats"]
