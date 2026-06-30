# Multi-stage build for the Orbity API (NestJS) in a pnpm monorepo.
# Build context must be the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t orbity-api .

# ---- Builder: install all deps, build @orbity/shared + api, prune to prod ----
FROM node:20-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Manifests first for better layer caching.
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

# Install the full workspace (dev deps included for the build).
# --ignore-scripts skips the root `prepare` (sources aren't copied yet).
RUN pnpm install --frozen-lockfile --ignore-scripts

# Sources, then build shared before api (api depends on shared's dist).
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @orbity/shared build \
  && pnpm --filter @orbity/api build

# Drop dev dependencies for a lean runtime.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# ---- Runner: minimal image running the compiled API ----
FROM node:20-slim AS runner
ENV NODE_ENV=production
ENV PORT=4000
WORKDIR /repo
COPY --from=builder /repo ./
WORKDIR /repo/apps/api

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
