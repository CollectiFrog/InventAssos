---
name: git-workflow
description: Branching model, Conventional Commits, pull requests and the release procedure (release/vX.Y.Z, tag, back-merge). Use before creating a branch, committing, opening a PR or preparing a release.
---

# Git workflow

## Branches

| Branch              | From   | Merges into | How                         |
|---------------------|--------|-------------|-----------------------------|
| `main`              | —      | —           | released code only          |
| `dev`               | `main` | —           | integration, default branch |
| `feat/<slug>`       | `dev`  | `dev`       | PR, **squash merge**        |
| `fix/<slug>`        | `dev`  | `dev`       | PR, **squash merge**        |
| `release/vX.Y.Z`    | `dev`  | `main`      | PR, **merge commit**        |
| `main` (back-merge) | —      | `dev`       | PR, **merge commit**        |

- Agents never push to `main` or `dev`. `main` is protected (PR, checks, no force-push);
  `dev` allows direct and force pushes by the maintainer only.
- `<slug>` is short kebab-case English: `feat/csv-export`, `fix/login-timeout`.
- Keep branches short-lived; rebase on `dev` (or merge `dev` in) before asking for review.
- An urgent production fix is a `fix/…` on `dev`, then a patch release.

## Commits: Conventional Commits

Format: `type(scope?): summary`, English, imperative, lower case, no final period, ≤ 72 chars.

| Type       | For                                   | SemVer bump |
|------------|---------------------------------------|-------------|
| `feat`     | a new user-visible capability         | minor       |
| `fix`      | a bug fix                             | patch       |
| `docs`     | documentation only                    | none        |
| `test`     | tests only                            | none        |
| `refactor` | code change with no behaviour change  | none        |
| `perf`     | performance improvement               | patch       |
| `build`    | build system, dependencies            | none        |
| `ci`       | CI configuration                      | none        |
| `chore`    | anything else (tooling, housekeeping) | none        |

A breaking change adds `!` (`feat!: drop v1 API`) and a `BREAKING CHANGE:` footer: **major** bump.

Because `feat/` and `fix/` PRs are squash-merged, **the PR title becomes the commit on `dev`**.
CI checks the PR title (`.github/workflows/pr-title.yml`); commits inside the branch are free-form.

## Pull requests

- Target `dev` (except release and back-merge PRs).
- Fill the PR template; tick only what is true.
- CI must be green: lint, typecheck, tests, build, docs build, PR title.
- One subject per PR. If the description needs "and also", split it.
- Agents prepare and open PRs; **merging is a human decision** unless the maintainer said otherwise.

## Versioning

[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`, tags `vX.Y.Z`.
The next version comes from the commits since the last tag (highest bump wins).

## Release procedure

Agents may prepare steps 1 to 3. **Tagging (step 5) is the maintainer's call.**

1. `git switch dev && git pull`, then `git switch -c release/vX.Y.Z`.
2. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add an empty
   `## [Unreleased]` above it, and the compare link at the bottom. Bump `appVersion` in
   `app/brand.ts` (shown on « Mon compte › À propos »).
   Only release fixes go on this branch, no features.
3. Commit `chore(release): vX.Y.Z`, push, open a PR `release/vX.Y.Z` → `main`.
4. Once green and approved: **merge commit** (not squash) into `main`.
5. Tag the merge commit on `main`: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
   The `release` workflow then checks the tag is on `main` and in the CHANGELOG, builds the
   Docker image, pushes `ghcr.io/<owner>/<repo>:X.Y.Z` and creates the GitHub Release.
   Without a terminal: Releases → Draft a new release → new tag `vX.Y.Z` on `main` → Publish;
   the workflow then fills in the notes from the CHANGELOG.
6. Back-merge: open a PR `main` → `dev`, **merge commit**. Delete `release/vX.Y.Z`.
7. Deployment: update the image tag in the infra repository (manual for now, see
   `docs/adr/0005-deployment.md` and `docs/dev/contribute/deploying.md`).

Pushes to `main` publish the user docs; pushes to `dev` publish the developer docs.
