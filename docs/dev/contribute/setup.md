---
title: Setup
description: Get a working development environment.
sidebar:
  order: 1
---

## Requirements

<!-- TEMPLATE: runtime and tools with versions, e.g. Node 22, Docker. -->

- Git, with symlinks enabled on Windows: `git config --global core.symlinks true`
  (and Developer Mode on), so `.claude/skills` resolves.
- Node.js ≥ 22.12, only to preview the documentation.

## Get the code

```sh
git clone <repo-url> && cd <repo>
git switch dev
```

## Run the checks

```sh
make check   # lint, typecheck, test, build: the same as CI
```

## Preview the documentation

```sh
cd docs/site && npm ci
npm run dev:user   # http://localhost:4321
npm run dev:dev    # http://localhost:4322
```
