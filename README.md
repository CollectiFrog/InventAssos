# Project Name

One sentence saying what this does and for whom.

**Documentation:** [user guide](https://OWNER.github.io/REPO/) ·
[developer docs](https://OWNER.github.io/REPO/dev/)

## Quick start

<!-- The shortest path to running it. Details go to docs/user/guides/installation.md. -->

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents start with [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

---

<!-- TEMPLATE: delete everything below once the checklist is done. -->

## Using this template

This repository is a GitHub template: AI-ready structure (`AGENTS.md`, `.ia/`), conventions,
Git workflow, CI/CD and a two-zone documentation site. It sets no language or framework.

### After "Use this template"

| Where                    | Do                                                                                                                       |
|--------------------------|--------------------------------------------------------------------------------------------------------------------------|
| Files                    | replace `Project Name`, `OWNER`, `REPO` (README, `docs/site/astro.config.mjs`)                                           |
| `LICENSE`                | check the copyright holder and year                                                                                      |
| `.ia/context/project.md` | fill it in (purpose, users, languages, stack)                                                                            |
| `Makefile`               | replace the four placeholders; add the language setup step in `ci.yml`                                                   |
| `AGENTS.md`              | add project-specific rules at the bottom; add language ecosystems to `dependabot.yml`                                    |
| Branches                 | `git switch -c dev && git push -u origin dev`; Settings → General → default branch `dev`                                 |
| Settings → General       | allow squash merge **and** merge commits; disable rebase merge; auto-delete head branches                                |
| Rules: ruleset `main`    | target **pattern `main`** (not "Default branch"); block deletion and force-push; PR with merge commit only               |
| Rules: `main` checks     | require `Lint, typecheck, test, build`, `Docs build`, `conventional-commit`                                              |
| Rules: ruleset `dev`     | block deletion only: the maintainer may push and force-push                                                              |
| Settings → Pages         | Source: **GitHub Actions** (not "Deploy from a branch")                                                                  |
| Settings → Environments  | `github-pages` → Deployment branches and tags → *Selected* → add rules `main` and `dev`; else the deploy job is rejected |
| On a phone               | open github.com in the browser with "Desktop site" on: the app has no repository settings                                |
| Settings → Security      | enable private vulnerability reporting, Dependabot alerts, secret scanning                                               |
| Projects                 | create the board, see `docs/dev/contribute/board.md`                                                                     |
| Windows clones           | `git config --global core.symlinks true` so `.claude/skills` resolves                                                    |

### Layout

```text
AGENTS.md              rules for every agent (single source)
CLAUDE.md              @AGENTS.md import only
.claude/skills  ->     ../.ia/skills (symlink)
.ia/
  context/project.md   what the project is
  skills/              coding-conventions, git-workflow
  sources/             external references
docs/
  user/                user docs, published from main at /
  dev/                 developer docs, published from dev at /dev/
  adr/                 architecture decision records (in the dev docs)
  site/                Starlight app rendering both
.github/
  workflows/           ci, pr-title, docs, release
  ISSUE_TEMPLATE/, pull_request_template.md, dependabot.yml
CHANGELOG.md CONTRIBUTING.md SECURITY.md LICENSE Makefile
```
