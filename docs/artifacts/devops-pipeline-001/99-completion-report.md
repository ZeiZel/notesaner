# Workflow Complete: devops-pipeline-001

## Summary

Restructured DevOps pipeline, Docker Compose setup, build process, added comprehensive healthchecks, and Storybook interaction testing.

## Commits (7 atomic, conventional)

1. `da0968a` feat(devops): restructure Docker Compose into modular files with profiles
2. `7db9a4f` feat(devops): add pre-built dist Dockerfiles for web and server
3. `a530d62` feat(ci): update CI/CD to use pre-built artifacts and new Dockerfiles
4. `ca0af72` feat(server): add comprehensive healthcheck with service probing
5. `923c78b` feat(web): add healthcheck API route
6. `8cfc883` feat(ui): add Storybook interaction tests and test runner
7. `66439e6` chore(nx): enforce build->test->lint dependency chain

## Quality Verification

- Server lint: PASS (0 errors, 2 pre-existing warnings)
- Web lint: PASS (0 errors, 0 warnings)
- UI lint: PASS (0 errors, 1 pre-existing warning)
- Docker Compose --profile dev: PASS (config valid)
- Docker Compose --profile infra: PASS (config valid)
- Docker Compose --profile all: PASS (config valid)
- Health module unit tests: 13/13 PASS
- Server full test suite: 2083 passed (27 pre-existing failures unrelated to this work)

## Files Changed

### Docker Compose (Group 1)

- NEW: docker-compose.yaml (root include file with profiles: dev, infra, all)
- NEW: docker/docker-compose.db.yml (PostgreSQL + ValKey)
- NEW: docker/docker-compose.back.yml (NestJS server)
- NEW: docker/docker-compose.web.yml (Next.js frontend)
- NEW: docker/docker-compose.infra.yml (Nginx, Prometheus, Grafana, Jaeger)
- DELETED: docker-compose.yml, docker-compose.dev.yml, docker-compose.monitoring.yml

### Dockerfiles (Group 2)

- NEW: docker/web.Dockerfile (consumes pre-built dist/)
- NEW: docker/server.Dockerfile (consumes pre-built dist/)
- MODIFIED: .dockerignore (allow dist/, .next/static)

### CI/CD (Group 3)

- MODIFIED: .github/workflows/ci.yml (download artifacts before Docker build, new Dockerfile names)
- MODIFIED: .github/workflows/release.yml (build-first approach, new Dockerfile names)

### Backend Healthcheck (Group 4.1)

- MODIFIED: apps/server/src/modules/health/health.controller.ts (comprehensive endpoint)
- MODIFIED: apps/server/src/modules/health/health.module.ts (new providers)
- NEW: apps/server/src/modules/health/health.service.ts
- NEW: apps/server/src/modules/health/health.types.ts
- NEW: apps/server/src/modules/health/indicators/database.health-indicator.ts
- NEW: apps/server/src/modules/health/indicators/valkey.health-indicator.ts
- NEW: apps/server/src/modules/health/**tests**/health.controller.spec.ts

### Frontend Healthcheck (Group 4.1)

- NEW: apps/web/app/api/health/route.ts

### Storybook (Group 4.2)

- MODIFIED: packages/ui/.storybook/main.ts (added interactions addon)
- MODIFIED: packages/ui/project.json (added storybook:test target)
- MODIFIED: packages/ui/src/stories/Button.stories.tsx (play function)
- MODIFIED: packages/ui/src/stories/CommandPalette.stories.tsx (search/select interactions)
- MODIFIED: packages/ui/src/stories/Input.stories.tsx (typing interaction)
- NEW: packages/ui/src/stories/CopyButton.stories.tsx (click-to-copy interaction)
- MODIFIED: package.json (added @storybook/addon-interactions, @storybook/test, @storybook/test-runner)

### NX Config (Group 3)

- MODIFIED: nx.json (test.dependsOn: ["lint"])

## Key Decisions

- Nginx moved to 'all' profile only (not 'infra' alone) since it depends on web/server
- Health status codes: start -> pending -> alive / error
- Dev mode always returns HTTP 200 for healthcheck (production returns 503 on error)
- Dockerfiles use host-built dist/ rather than building inside Docker
- CI uploads both dist/ and web static assets as separate artifacts
