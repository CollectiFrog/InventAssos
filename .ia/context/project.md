# Project context

## What and why

Volunteer associations doing scenography, sound, lighting and events each keep a private, more or
less complete inventory of their equipment. InventAssos is a web platform where each association
(a *collectif*) keeps its inventory with its members and responsibles: what it owns, where it is
stored, who holds it. Until V1.1 an inventory is seen only inside its collectifs
([ADR 0021](../../docs/adr/0021-inventory-within-collectifs.md)); sharing with other collectifs, so
they can arrange a loan, rental or swap directly with the owner, comes with fine-grained
visibility. Open source (MIT), self-hosted.

## Users

| Actor            | Situation                                                                      |
|------------------|--------------------------------------------------------------------------------|
| Visitor          | not signed in; can sign up and read the legal pages                            |
| Pending user     | signed up, waiting for platform-admin approval                                 |
| Validated user   | sees their collectifs' inventory, manages their own locations and equipment    |
| Collectif member | validated user who keeps a collectif's equipment (from V0.8)                   |
| Responsible      | validated user who manages one or more collectifs, their locations and members |
| Moderator        | handles the approval queue and moderation; named by an admin (from V0.8)       |
| Platform admin   | approves accounts and collectifs, names moderators; listed in an env variable  |

## Languages

| Scope                             | Language |
|-----------------------------------|----------|
| Code, comments, commits, dev docs | English  |
| User interface, user docs         | French   |

## Stack

- Remix 3 for UI and server, Node ≥ 24.3: [ADR 0006](../../docs/adr/0006-remix-3-full-stack.md).
- One responsive interface, rules in `docs/dev/architecture/ui.md`: [ADR 0019](../../docs/adr/0019-interface-conventions.md).
- PostgreSQL: [ADR 0007](../../docs/adr/0007-postgresql.md).
- Accounts managed by the app, sign-in by e-mail link: [ADR 0008](../../docs/adr/0008-app-managed-accounts.md).
- Photos in MinIO (S3) from V0.9. E-mail through the Collecti'FROG Zimbra SMTP (`noreply@collecti-frog.fr`).

## Deployment

- Container image: `ghcr.io/collectifrog/inventassos:X.Y.Z`, built on each `vX.Y.Z` tag.
- Manifests: in Tristan's infra repository; the cluster pulls the image from GHCR. Tag updated by
  hand until Argo CD is ready ([ADR 0005](../../docs/adr/0005-deployment.md)).
- Proof-of-concept URL: `inv.collecti-frog.fr`, published by Collecti'FROG, hosted by Tristan
  (legal host) on servers maintained by TFGL (informal group, no legal entity).

## Boundaries

- No loans, bookings or availability calendar before V1.3 / V1.4: users call the owner.
- No sharing before V1.1: an item is seen only by the people of the collectifs that own or hold it
  (ADR 0021); every validated user sees the collectifs directory (name, city, description).
- No exact address shown to others: only the city of a location.
- No passwords stored; no SSO before V1.0.

## Glossary

| Term           | Meaning                                                                                                               |
|----------------|-----------------------------------------------------------------------------------------------------------------------|
| Collectif      | an association registered on the platform                                                                             |
| Responsible    | user allowed to manage a collectif, its locations and its equipment                                                   |
| Location       | a place where equipment is stored, owned by a collectif or by a person                                                |
| Item           | one piece of equipment, or a batch of identical ones (`quantity` ≥ 1)                                                 |
| Owner          | the collectif or the person an item belongs to; may differ from the location                                          |
| Platform admin | listed in `PLATFORM_ADMIN_EMAILS`; names moderators ([ADR 0020](../../docs/adr/0020-platform-and-collectif-roles.md)) |
| Moderator      | approves accounts and collectifs, moderates content (from V0.8)                                                       |
| Member         | of a collectif: keeps its equipment, approved by its responsibles (from V0.8)                                         |
