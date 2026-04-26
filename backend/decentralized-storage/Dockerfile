# ─────────────────────────────────────────────────────────────
# Dockerfile — QSDID Storage Manager + Kubo v0.39
# Multi-stage build: downloads Kubo, then runs the Node.js service.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# ── Stage 1: install Node deps ────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: download Kubo v0.39.0 binary ─────────────────────
FROM alpine:3.19 AS kubo-download
ARG KUBO_VERSION=v0.39.0
ARG TARGETARCH=amd64

RUN apk add --no-cache curl tar libc6-compat
RUN curl -sSL "https://github.com/ipfs/kubo/releases/download/${KUBO_VERSION}/kubo_${KUBO_VERSION}_linux-${TARGETARCH}.tar.gz" \
    -o /kubo.tar.gz && \
    tar -xzf /kubo.tar.gz && \
    mv kubo/ipfs /usr/local/bin/ipfs && \
    chmod +x /usr/local/bin/ipfs && \
    /usr/local/bin/ipfs version

# ── Stage 3: final image ──────────────────────────────────────
FROM node:20-alpine AS final

# Install bash (needed by init-kubo.sh), tini (PID 1 reaping), and libc compatibility for Kubo
RUN apk add --no-cache bash tini libc6-compat gcompat

# Create IPFS data directory
RUN mkdir -p /data/ipfs
ENV IPFS_PATH=/data/ipfs

WORKDIR /app

# Copy Kubo binary from download stage
COPY --from=kubo-download /usr/local/bin/ipfs /usr/local/bin/ipfs

# Copy Node deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Make init script executable
RUN chmod +x ./scripts/init-kubo.sh

# ── Entrypoint script ─────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3500
EXPOSE 9091

ENTRYPOINT ["/sbin/tini", "--", "/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
