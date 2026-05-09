# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web-control/package.json apps/web-control/
COPY apps/web-slideshow/package.json apps/web-slideshow/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY . .
RUN pnpm --filter @photolive/server build && \
    pnpm --filter @photolive/web-control build && \
    pnpm --filter @photolive/web-slideshow build && \
    pnpm prune --prod

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Sharp has prebuilt binaries; better-sqlite3 too. We just need libstdc++ (already in slim).
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared ./packages/shared
COPY --from=build /repo/apps/server/dist ./apps/server/dist
COPY --from=build /repo/apps/server/drizzle ./apps/server/drizzle
COPY --from=build /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /repo/apps/web-control/dist ./apps/web-control/dist
COPY --from=build /repo/apps/web-slideshow/dist ./apps/web-slideshow/dist

EXPOSE 3001 2121 50000-50100/tcp
WORKDIR /app/apps/server
CMD ["node", "dist/main.js"]
