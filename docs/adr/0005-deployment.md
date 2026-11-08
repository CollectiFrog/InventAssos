---
title: "0005: Deployment through GHCR and a separate infra repository"
description: CD stops at the image; the infra repository is updated by hand for now.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-07 | @tritriper |

## Context

Deployment manifests live in a separate infra repository; the Kubernetes cluster pulls images
from GHCR. Something must change the image tag in the infra repository after a release.

## Decision

The release workflow builds and pushes `ghcr.io/<owner>/<repo>:X.Y.Z` on a `vX.Y.Z` tag and stops
there. The image tag in the infra repository is updated **by hand** for now. Argo CD with Image
Updater is the intended next step, recorded in a future ADR that supersedes this one.

## Alternatives

| Option                         | Why not now                                         |
|--------------------------------|-----------------------------------------------------|
| Automatic PR on the infra repo | needs a cross-repo token; replaced by Argo CD later |
| Argo CD Image Updater          | Argo CD not set up yet                              |
| Flux image automation          | not the chosen GitOps tool                          |

## Consequences

One manual step per release (`git-workflow` step 7). The image tag is immutable: never re-push
an existing `X.Y.Z`.
