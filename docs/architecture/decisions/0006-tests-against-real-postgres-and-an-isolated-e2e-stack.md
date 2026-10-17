# 6. Integration tests on a per-run database, end-to-end tests in an isolated stack

Date: 2026-10-17

## Status

Accepted

## Context

Fortuna runs API integration tests with testcontainers. From inside the workspace
container that needs Docker-in-Docker networking. The behaviors that matter most here
(visibility, tenant isolation, upload handling) depend on real SQL and real files.

## Decision

- API integration suites create a throwaway database on the compose Postgres, apply
  the real migrations, and drop it afterwards. No database mocks.
- Playwright runs against a separate Compose project with its own database, media
  volume and fixture admin, created and destroyed by `bin/closeout e2e`.

## Consequences

- Integration tests need the dev stack's Postgres running.
- E2E runs are independent of local data and repeatable on any machine with Docker.
