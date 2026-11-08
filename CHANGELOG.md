# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).
One change per line, written for users. Sections: Added, Changed, Deprecated, Removed, Fixed, Security.

## [Unreleased]

### Added

- First page of the application, in French, served from a Remix 3 + PostgreSQL skeleton.
- Sign-up: a visitor asks for an account with their name and e-mail; platform admins are notified by e-mail.
- Sign-in without password: a single-use link valid 15 minutes is sent by e-mail; sessions last 30 days.
- Sign-out button in the header; it closes the session on the server.
- "Votre compte" page: a pending or rejected person sees where their request stands and can apply again after a rejection.
- Platform admins are the e-mails listed in `PLATFORM_ADMIN_EMAILS`: their account is created and activated at their first sign-in.
- Administration page: admins accept or reject pending accounts, with an optional reason; the person is told by e-mail.
- Admins can disable an account: the person is signed out at once and can no longer sign in; nothing is deleted.
- Collectifs page; a validated user can request a new collectif, checked by an admin, with a unique name.
- Admins accept or reject collectif requests; on acceptance the requester becomes the collectif's responsible.
- Collectif page with its description, contact phone and responsibles; a validated user can ask to become responsible.
- Admins accept or reject requests to become responsible of a collectif.
- Responsibles edit their collectif's description and contact phone.
- Administration is one queue at `/admin` with pending accounts, collectifs and responsibles and their counts.
- Storage locations: responsibles create, edit and delete their collectif's locations from "Mes lieux".
- "Inventaire" page: the whole active inventory of the platform, paginated.
- Items: add equipment (category, quantity, brand, model, condition, value…) to a location you manage; "Mon matériel" lists it.
- A responsible can store in the collectif's location an item owned by a person (deposit), identified by their e-mail.
- Edit an item: its owner and the managers of its location.
- Move an item to another location you manage; each move is recorded.
- Archive a sold, lost or broken item: it leaves the inventory but keeps its page and history.
- Item history: created, edited, moved and archived, with date and author.
- Location page; only the city is shown to others, the address and notes stay with the location's managers and admins.
- Personal storage locations: every validated user lists the places where they keep equipment.
- Admins remove a responsible; the last one can only be removed by naming a replacement.
- Profile page: edit your name and an optional phone number, shown to validated users.

<!-- Compare links, one per release:
[Unreleased]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.(Z-1)...vX.Y.Z
-->

[Unreleased]: https://github.com/CollectiFrog/InventAssos/commits/dev
