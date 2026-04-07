# DevOps Pipeline Restructuring — Requirements

## Workflow ID: devops-pipeline-001

## User Request Summary

Restructure the DevOps pipeline, Docker Compose setup, build process, and add healthchecks + Storybook.

## Task Groups

### Group 1: Docker Compose Restructuring (DevOps)

- 1.1. All docker compose files must live in `docker/` directory
- 1.2. Split into separate files: `docker-compose.web.yml`, `docker-compose.back.yml`, `docker-compose.db.yml`, `docker-compose.infra.yml` (monitoring, tracing, etc.)
- 1.3. All files are included from a single `docker-compose.yaml` in the project root
- 1.4. Services must use Docker profiles: `dev`, `infra`, `all`

### Group 2: Build Pipeline (DevOps)

- 2.1. In CI pipeline (GitHub Actions) and locally: first build affected packages via NX
- 2.2. CI: upload build artifacts for subsequent pipeline steps
- 2.3. Dockerfiles consume pre-built artifacts from `./dist/apps/` (e.g., `web.Dockerfile` takes only `web` from dist)
- 2.4. Update existing Dockerfiles to use pre-built dist instead of building inside Docker

### Group 3: NX Project Organization (DevOps)

- 3.1. `build` must dependsOn `test`, and `test` must dependsOn `lint`
- NOTE: nx.json already has `build.dependsOn: ["lint", "test", "^build"]` — verify test->lint chain

### Group 4: Application Enhancements

#### 4.1. Healthchecks (Backend + Frontend)

- Backend: comprehensive healthcheck endpoint checking all available services (DB, ValKey, etc.)
- Frontend: healthcheck API route
- Status codes: `start`, `pending`, `alive`, `error`
- In dev mode, must return 200

#### 4.2. Storybook (Frontend)

- Add Storybook for application components (not just packages/ui)
- Add smoke testing for component rendering
- Add interaction testing (clicks, user interactions via Storybook play functions)

## Acceptance Criteria

- Docker Compose: `docker compose --profile dev up` works
- Build: `pnpm nx affected -t build` produces artifacts in `dist/`
- Dockerfiles: consume from `dist/` not build internally
- Healthcheck backend returns proper status JSON with service statuses
- Healthcheck frontend returns 200 in dev mode
- Storybook builds and runs interaction tests
- Everything builds and starts within 5 minutes (excluding image pulls)

## Domain Routing

- **DevOps architect**: Groups 1, 2, 3
- **Backend architect**: Group 4.1 (server healthcheck)
- **Frontend architect**: Group 4.1 (web healthcheck) + Group 4.2 (Storybook)
