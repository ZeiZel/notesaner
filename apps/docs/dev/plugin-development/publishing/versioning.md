---
title: Versioning & Updates
description: Semantic versioning for plugins and how updates reach users.
---

# Versioning & Updates

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## Semantic Versioning

Use [SemVer](https://semver.org):

- **Patch** (1.0.X): Bug fixes only
- **Minor** (1.X.0): New features, backwards compatible
- **Major** (X.0.0): Breaking changes

## Publishing an Update

1. Bump the version in `manifest.json` and `package.json`
2. Build: `pnpm build`
3. Create a GitHub release with the new bundle
4. Update `downloadUrl` in the registry PR

## Breaking Changes

Increment the major version and document the breaking changes in your CHANGELOG.
