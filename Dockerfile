# Build stage
FROM node:20-slim AS builder

RUN corepack enable pnpm

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/

RUN pnpm build

# Runtime stage
FROM node:20-slim

RUN corepack enable pnpm

# Install wget for downloads
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src ./src
COPY drizzle.config.ts tsconfig.json ./
COPY public/ ./public/

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:migrate && node dist/index.js"]
