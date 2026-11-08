# Project context

<!-- TEMPLATE: fill every section in a few lines, then delete this comment. Keep it under ~80 lines. -->

## What and why

<!-- One paragraph: the problem solved and for whom. -->

## Users

<!-- Who uses it, in which situation. -->

## Languages

| Scope                             | Language             |
|-----------------------------------|----------------------|
| Code, comments, commits, dev docs | English              |
| User interface, user docs         | <!-- e.g. French --> |

## Stack

<!-- Runtime, framework, database, hosting. Link the ADR for each choice. -->

## Deployment

- Container image: `ghcr.io/<owner>/<repo>:X.Y.Z`, built on each `vX.Y.Z` tag.
- Manifests: in the infra repository <!-- link -->; the cluster pulls the image from GHCR.

## Boundaries

<!-- What the project deliberately does not do. -->

## Glossary

| Term | Meaning |
|------|---------|
