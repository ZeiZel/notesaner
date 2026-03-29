---
title: Submitting a Pull Request
description: Branch naming, conventional commits, PR checklist, and review process.
---

# Submitting a Pull Request

## Branch Naming

```
feat/short-description          # New feature
fix/short-description           # Bug fix
chore/short-description         # Tooling, dependencies, docs
refactor/short-description      # Code refactoring
test/short-description          # Tests only
```

## Conventional Commits

All commit messages must follow [Conventional Commits](https://www.conventionalcommits.org):

```
feat: add collaborative cursors to editor
fix: resolve note sync failing on slow connections
chore: update Docusaurus to 3.7.0
docs: add self-hosting guide for Caddy
refactor: extract note persistence to separate service
test: add E2E tests for note creation flow
```

## PR Checklist

Before opening a PR, verify:

- [ ] Tests pass: `pnpm nx affected -t test`
- [ ] Lint passes: `pnpm nx affected -t lint`
- [ ] TypeScript compiles: `pnpm nx affected -t type-check`
- [ ] PR description explains what and why
- [ ] Breaking changes are documented
- [ ] Screenshots/screen recording for UI changes

## Review Process

1. Open a PR against `main`
2. CI runs automatically (tests, lint, type check)
3. A maintainer reviews within 3 business days
4. Address feedback with new commits (don't force-push)
5. Maintainer merges when approved
