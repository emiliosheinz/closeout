# syntax=docker/dockerfile:1.18-labs
# -------- Development (with hot reload) --------
FROM node:24-alpine AS dev

RUN apk add --no-cache curl

RUN corepack enable pnpm && corepack install -g pnpm@11.1.0

WORKDIR /closeout

CMD ["pnpm", "turbo", "start:dev", "--filter=web"]



# -------- Production Builder --------
FROM node:24-alpine AS builder

RUN corepack enable pnpm && corepack install -g pnpm@11.1.0

WORKDIR /closeout

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY --parents packages/*/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages packages

RUN pnpm turbo build --filter=web



# -------- Production --------
FROM node:24-alpine AS prod

WORKDIR /closeout

RUN apk add --no-cache curl

COPY --from=builder /closeout/apps/web/.next/standalone ./
COPY --from=builder /closeout/apps/web/public ./apps/web/public
COPY --from=builder /closeout/apps/web/.next/static ./apps/web/.next/static

USER node

CMD ["node", "apps/web/server.js"]
