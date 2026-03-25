# GitHub Actions Pipelines

## CI Pipeline (.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-test-build:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: notesaner_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      valkey:
        image: valkey/valkey:8-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "valkey-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Set NX SHAs
        uses: nrwl/nx-set-shas@v4

      - name: Lint affected
        run: pnpm nx affected -t lint

      - name: Type check affected
        run: pnpm nx affected -t type-check

      - name: Test affected
        run: pnpm nx affected -t test
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/notesaner_test
          VALKEY_URL: valkey://localhost:6379

      - name: Build affected
        run: pnpm nx affected -t build
```

## Release Pipeline (.github/workflows/release.yml)

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read
  packages: write

jobs:
  docker:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [web, server]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile.${{ matrix.app }}
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/${{ matrix.app }}:${{ steps.version.outputs.VERSION }}
            ghcr.io/${{ github.repository }}/${{ matrix.app }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## E2E Tests Pipeline (.github/workflows/e2e.yml)

```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Start services
        run: docker compose -f docker-compose.yml up -d

      - name: Wait for services
        run: |
          npx wait-on http://localhost:4000/health
          npx wait-on http://localhost:3000

      - name: Run E2E tests
        run: pnpm nx e2e web-e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web-e2e/playwright-report/
```
