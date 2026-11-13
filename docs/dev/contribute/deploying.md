---
title: Deploy on Kubernetes
description: Run a released version on a cluster, from the image to the first admin.
sidebar:
  order: 5
---

This guide puts a released version of AssoMatos in production on Kubernetes, from the docs alone
(US-0.8.11). The real manifests live in the infra repository ([ADR 0005](../../adr/0005-deployment/));
the ones below are a complete starting point to copy there. The proof of concept runs at
`https://assomatos.collecti-frog.fr`.

## What you need

| Piece        | Requirement                                                                                     |
|--------------|-------------------------------------------------------------------------------------------------|
| Image        | `ghcr.io/collectifrog/inventassos:X.Y.Z`, pushed by the `release` workflow for tag `vX.Y.Z`      |
| PostgreSQL   | version 17 (the version CI tests against); one empty database and a user that owns it           |
| SMTP         | an account that may send as `MAIL_FROM` (the Collecti'FROG Zimbra in production)                 |
| Ingress      | TLS termination for the public host; it forwards plain HTTP to the container; bodies up to 3 MB  |
| A DNS record | the public host, which becomes `APP_URL`                                                         |

The database user needs no superuser right and no extension: migrations only create tables,
indexes and one SQL function (`inv_fold`, written without `unaccent` so that a managed
PostgreSQL works). Back the database up like any other: see [GDPR checklist](../../product/gdpr-checklist/)
for retention.

## Image

Use an immutable tag `X.Y.Z`, never `latest`. If the GHCR package is private, add an
`imagePullSecrets` entry with a token that may read packages. The image:

- runs as the unprivileged `node` user (UID 1000) and writes nothing to disk, so the root
  filesystem can be read-only;
- listens on `PORT` (3000) in plain HTTP;
- applies pending migrations at startup, before it listens;
- stops cleanly on `SIGTERM`: it finishes the requests and e-mails in flight, then closes the
  database.

## Environment

| Variable                | Secret | Value                                                                            |
|-------------------------|--------|----------------------------------------------------------------------------------|
| `DATABASE_URL`          | yes    | `postgres://user:password@host:5432/inventassos`                                 |
| `SESSION_SECRET`        | yes    | ≥ 32 random characters (`openssl rand -base64 48`); the example value is refused |
| `SMTP_URL`              | yes    | e.g. `smtps://noreply%40collecti-frog.fr:password@mail.example:465`              |
| `APP_URL`               | no     | public origin, used in e-mail links and to check form origins (CSRF)            |
| `PLATFORM_ADMIN_EMAILS` | no     | comma-separated e-mails that become admin at first sign-in; read at startup      |
| `MAIL_FROM`             | no     | `AssoMatos <noreply@collecti-frog.fr>`                                         |
| `TRUST_PROXY`           | no     | `true` behind the ingress, so rate limits see the visitor's address (ADR 0018)   |
| `PORT`                  | no     | container port, default `3000`                                                   |

`.env.example` is the reference list. A missing or invalid variable stops the container at startup
with a message naming it. `APP_URL` must be exactly the address people type, `https://` included:
a form posted from another origin is refused.

Secrets go in a Kubernetes `Secret` created from the command line or a sealed/external secret,
never in clear in the infra repository:

```sh
kubectl -n inventassos create secret generic inventassos \
  --from-literal=DATABASE_URL='postgres://inventassos:…@postgres:5432/inventassos' \
  --from-literal=SESSION_SECRET="$(openssl rand -base64 48)" \
  --from-literal=SMTP_URL='smtps://noreply%40collecti-frog.fr:…@mail.example:465'
```

Changing `SESSION_SECRET` signs everyone out; keep it stable across releases.

## Manifests

```yaml
apiVersion: v1
kind: ConfigMap
metadata: { name: inventassos, namespace: inventassos }
data:
  APP_URL: https://assomatos.collecti-frog.fr
  MAIL_FROM: AssoMatos <noreply@collecti-frog.fr>
  PLATFORM_ADMIN_EMAILS: admin@collecti-frog.fr
  TRUST_PROXY: "true"
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: inventassos, namespace: inventassos }
spec:
  replicas: 2
  selector: { matchLabels: { app: inventassos } }
  strategy: { type: RollingUpdate, rollingUpdate: { maxUnavailable: 0, maxSurge: 1 } }
  template:
    metadata: { labels: { app: inventassos } }
    spec:
      securityContext: { runAsNonRoot: true, runAsUser: 1000, seccompProfile: { type: RuntimeDefault } }
      terminationGracePeriodSeconds: 30
      containers:
        - name: app
          image: ghcr.io/collectifrog/inventassos:X.Y.Z
          ports: [{ name: http, containerPort: 3000 }]
          envFrom:
            - configMapRef: { name: inventassos }
            - secretRef: { name: inventassos }
          readinessProbe: { httpGet: { path: /readyz, port: http }, periodSeconds: 10 }
          livenessProbe:
            httpGet: { path: /healthz, port: http }
            periodSeconds: 20
            failureThreshold: 3
          startupProbe:
            # Migrations run before the server listens: give them time on a large release.
            httpGet: { path: /healthz, port: http }
            periodSeconds: 5
            failureThreshold: 60
          resources:
            requests: { cpu: 50m, memory: 128Mi }
            limits: { memory: 384Mi }
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: [ALL] }
---
apiVersion: v1
kind: Service
metadata: { name: inventassos, namespace: inventassos }
spec:
  selector: { app: inventassos }
  ports: [{ name: http, port: 80, targetPort: http }]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: inventassos, namespace: inventassos }
spec:
  tls: [{ hosts: [assomatos.collecti-frog.fr], secretName: inventassos-tls }]
  rules:
    - host: assomatos.collecti-frog.fr
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: inventassos, port: { name: http } } }
```

The import accepts CSV files up to 2 MB (ADR 0026). An NGINX ingress refuses bodies over 1 MB by
default: add `nginx.ingress.kubernetes.io/proxy-body-size: 3m` to the Ingress annotations (or the
equivalent of your controller), else a large file fails before it reaches the app. Files being
imported wait in the `imports` table for an hour; leave its data out of backups
(`pg_dump --exclude-table-data=imports`).

Adapt the namespace, the host, the TLS secret (or your cert-manager annotation) and the ingress
class to the cluster. The resource figures are a starting point for a few associations: watch
the pod's memory after a week and adjust.

Several replicas are safe: sessions and rate limits live in PostgreSQL (ADR 0017, ADR 0018),
nothing is kept in a pod's memory between requests, and migrations take an advisory lock.

The app sets its own browser security headers on every response: `Content-Security-Policy` (no
script, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: same-origin`, and `Strict-Transport-Security` when `APP_URL` is https. The
ingress does not need to add them; if it does, check that its values are not weaker.

## Probes

| Path       | Use as          | Answers                                                                  |
|------------|-----------------|--------------------------------------------------------------------------|
| `/healthz` | liveness probe  | `200 {"status":"ok"}` while the process runs; never queries the database |
| `/readyz`  | readiness probe | `200` when PostgreSQL answers, `503 {"status":"unavailable"}` otherwise  |

The liveness probe ignores the database on purpose: a database outage must not make Kubernetes
restart every pod in a loop. Both answers carry `Cache-Control: no-store`.

## Migrations

Pending migrations run at startup, before the server listens (ADR 0013), under a PostgreSQL
advisory lock, so several replicas can start together. If a migration fails, the container exits
and never becomes ready: with `maxUnavailable: 0` the previous pods keep serving. Read the pod
logs, fix forward with a `fix/…` release.

## First deployment and first admin

1. Create the namespace, the `Secret` and the database, then apply the manifests with your e-mail
   in `PLATFORM_ADMIN_EMAILS`.
2. Wait for the pods to be ready: `kubectl -n inventassos rollout status deploy/inventassos`.
3. Check `curl -fsS https://assomatos.collecti-frog.fr/readyz`, then open the home page.
4. Choose **Se connecter** with the listed e-mail and follow the link received: the account is
   created and validated at once, as admin. If no e-mail arrives, the pod log names the SMTP error.
5. In **Administration**, accept the first accounts and collectifs; name moderators in the
   **Modérateurs** tab to share the work (user guide: *Administration*).

Admins come only from `PLATFORM_ADMIN_EMAILS`. Adding or removing one is a change of the
`ConfigMap` followed by a restart: `kubectl -n inventassos rollout restart deploy/inventassos`.

## Deploy a version

1. Release `vX.Y.Z` (see the git-workflow skill); wait for the `release` workflow to push the image.
2. In the infra repository, set the image to `ghcr.io/collectifrog/inventassos:X.Y.Z` and apply.
3. Check `/readyz` and the home page as above. Each new pod migrates before it serves.

## Roll back

1. In the infra repository, set the image back to the previous tag and apply.
2. Check `/readyz` and the home page as above.

The schema is **not** rolled back with the image. Migrations are written to stay compatible with
the previous release (add columns or tables, drop them only in a later release), so the previous
image runs on the newer schema. Only if a release must be undone together with its schema, and the
migration has a `down.sql`, revert it from a checkout of the released tag, with `DATABASE_URL`
pointing at production (for example through `kubectl port-forward`):

```sh
node --env-file=.env node_modules/.bin/remix db rollback --step 1 --dry-run   # read the plan
node --env-file=.env node_modules/.bin/remix db rollback --step 1
```

Take a `pg_dump` before any schema rollback.
