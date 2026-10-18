# syntax=docker/dockerfile:1.18-labs
# -------- Dev (with hot reload) --------
FROM node:24-alpine AS dev

RUN apk add --no-cache curl

RUN corepack enable pnpm && corepack install -g pnpm@11.1.0

WORKDIR /closeout

CMD ["pnpm", "turbo", "start:dev", "--filter=api"]



# -------- Production Builder --------
FROM node:24-alpine AS builder

RUN corepack enable pnpm && corepack install -g pnpm@11.1.0

WORKDIR /closeout

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY --parents packages/*/package.json ./

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages

RUN pnpm turbo build --filter=api

# Prune to runtime-only (dist + prod deps)
RUN pnpm -F api deploy --prod /out



# -------- Production --------
FROM node:24-alpine AS prod

WORKDIR /closeout

RUN apk add --no-cache curl

COPY --from=builder /out ./

USER node

CMD ["node", "dist/main"]
