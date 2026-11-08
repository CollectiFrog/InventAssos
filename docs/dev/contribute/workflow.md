---
title: Workflow
description: Branches, commits, pull requests and conventions.
sidebar:
  order: 2
---

The rules live in one place, read by humans and agents alike. This page only points to them:

| Topic                                   | Source of truth                          |
|-----------------------------------------|------------------------------------------|
| General rules, repository map           | `AGENTS.md`                              |
| Branches, Conventional Commits, release | `.ia/skills/git-workflow/SKILL.md`       |
| Comments, tests, docs, dependencies     | `.ia/skills/coding-conventions/SKILL.md` |
| Contribution steps                      | `CONTRIBUTING.md`                        |

In short: branch `feat/…` or `fix/…` from `dev`, ship code + tests + docs + CHANGELOG line in one
PR, give it a Conventional Commit title, wait for green CI and a review.
