# 2. A NestJS API as the only database owner, a Next.js web client

Date: 2026-10-17

## Status

Accepted

## Context

The storefront needs a public catalog rendered on the server (fast first paint and
link previews from WhatsApp), an admin area, image processing and authentication.
The author's existing projects use a `apps/api` (NestJS + TypeORM + PostgreSQL) and
`apps/web` (Next.js) monorepo with Docker-first tooling. A single Next.js app with
server actions and a different ORM would have fewer moving parts.

## Decision

Follow the established split: the API is the only component that touches the
database and media storage; the web app renders pages on the server by calling the
API, and the browser reaches the API only through same-origin rewrites
(`/api/v1/*`, `/media/*`). Tooling (pnpm, Turborepo, Biome, Jest, Playwright,
`bin/<app>`) mirrors Fortuna. Nx release is left out: there is no release pipeline.

## Consequences

- One HTTP hop between web and API, inside the Docker network.
- The domain, authorization and tenant rules live in one place and are tested with
  integration tests against Postgres.
- Conventions transfer directly from the author's other repositories.
