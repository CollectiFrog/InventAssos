# Contributing

Thanks for helping. The rules are the same for humans and coding agents: they live in
[AGENTS.md](AGENTS.md) and the skills it lists. This page is the short path.

1. **Find or open an issue** describing the problem. For a large change, discuss it first.
2. **Branch from `dev`**: `feat/<slug>` or `fix/<slug>`.
3. **Make the change with its tests, docs and `CHANGELOG.md` line** (see
   [`coding-conventions`](.ia/skills/coding-conventions/SKILL.md)).
4. **Run `make check`** locally.
5. **Open a PR to `dev`** with a [Conventional Commit](https://www.conventionalcommits.org/) title,
   e.g. `fix(auth): refresh expired sessions`, and fill the template.
6. **Wait for green CI and a review.** The PR is squash-merged.

Releases follow [`git-workflow`](.ia/skills/git-workflow/SKILL.md).
Development setup: `docs/dev/contribute/setup.md`.

Code, commits and technical docs are in English; user-facing text is in the project language.
