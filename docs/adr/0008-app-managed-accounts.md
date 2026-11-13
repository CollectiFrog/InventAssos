---
title: "0008: App-managed accounts with e-mail sign-in links"
description: No passwords and no SSO until V1.0; OIDC can be added later.
---

| Status             | Date       | Deciders   |
|--------------------|------------|------------|
| Superseded by 0029 | 2026-11-06 | @tritriper |

## Context

Volunteers must be able to sign up on their own from a shared link. The existing self-hosted
identity stack (lldap + Authelia, used for other services) has no self-registration. The proof of
concept should not depend on it.

## Decision

The app manages its own accounts. Sign-in is a single-use link sent by e-mail (15 min proposed),
followed by a cookie session. No password is stored. The auth code is written so that an OIDC
provider can be added later without changing the account model.

## Alternatives

| Option                                 | Pros                    | Cons                                                       | Why not                         |
|----------------------------------------|-------------------------|------------------------------------------------------------|---------------------------------|
| lldap + Authelia, app creates accounts | one directory           | app holds lldap admin rights shared with personal services | security and separation         |
| Migrate everything to Authentik        | invitations, one system | migration of existing services                             | separate project                |
| Dedicated Authentik for associations   | clean separation        | one more service to run                                    | not needed for a single app yet |

## Consequences

- E-mail delivery is critical: SMTP through the Collecti'FROG Zimbra (`noreply@collecti-frog.fr`).
- SSO becomes worthwhile when associations share several tools; that will be a new ADR.
