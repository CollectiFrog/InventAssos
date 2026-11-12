# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [SemVer](https://semver.org/).
One change per line, written for users. Sections: Added, Changed, Deprecated, Removed, Fixed, Security.

## [Unreleased]

### Added

- Contributors can run the app, its tests and the checks with only Docker installed, or in a VS Code Dev Container.
- Navigation with four entries (Accueil, Rechercher, Mon matériel, Collectifs): a tab bar at the bottom of the screen on a phone, a sidebar with your collectifs on a computer.
- On a computer, every page has a search field and an « Ajouter du matériel » button at the top.
- Collectifs page: your collectifs first, then a directory of all collectifs with their city, searchable by name or city.
- A collectif states its city, asked when it is declared and editable by its responsibles.
- Dashboard on the home page: search first, equipment recently added to your collectifs, your collectifs, and the pending requests for admins.
- A location can be created from the « Ajouter du matériel » form, so having no location yet no longer blocks you.
- A collectif's page has tabs Matériel, Lieux and Responsables, with « Ajouter du matériel » first for its responsibles; deposits in its locations are listed apart.
- An item's page shows its owner and city at the top with « Appeler », « SMS » and « Écrire » buttons; writing is offered even when a phone is known.
- After signing in from a link to a page of the app, you land on that page instead of the home page.
- Admins manage the categories: add, rename, reorder, and delete one after moving its equipment to another.
- Clearer feedback: a message after signing out and after moving a category, the contact form's error under its field, empty searches that propose what to do, and the add form recalls location and owner right above « Ajouter ».
- Rechercher and a collectif's equipment show as a sortable table on a computer (cards with « Grille »), with filters on the left, counts per category and city, and removable active filters.
- Administration is split into tabs at their own addresses: Demandes, Comptes, Collectifs (new overview of validated collectifs) and Catégories.
- « Mon compte » is a settings page in sections (profile, collectifs, session, about, delete) with contents; « Supprimer mon compte » explains what deletion will do in V1.0.
- Detail pages show a breadcrumb on a computer and a « Retour » link on a phone; the item forms use the width of a computer screen, two fields per row.
- Accessibility: every button, field and menu is at least 44 px high, the account button's name starts with its initials, and the logo link keeps its name on the narrow sidebar; an automated audit checks the key pages.
- Moderators: admins name and remove them in Administration › Modérateurs; moderators handle the requests, disable or re-enable accounts, manage categories and see every collectif's equipment, but never act on an admin or another moderator.
- Admins and moderators can archive an abusive item with « Retiré par la modération »; its owner receives their message by e-mail.

### Changed

- The account is reached from a round button with your initials; « Se déconnecter » moved to the account page.
- Pages use the whole width of a computer screen instead of a narrow centred column.
- « Mon matériel » lists what is stored at your places right now (yours, your collectifs', borrowed), with a Lieux tab for your own locations; a collectif's locations are on its page.
- Each collectif's equipment, locations and people are now seen only by its responsibles, the people who own the items and those who store them; other collectifs show only their name and presentation.

## [0.6.1] - 2026-11-10

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
- Inventory search (name, brand, model, description; case and accents ignored) and filters by category, collectif and city.
- Item page shows the owner's contact phone; without one, a form e-mails the owner without revealing their address.
- Collectif and person pages list the equipment they own.
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
- Admins can re-enable a disabled account from the administration page.

### Fixed

- An admin can no longer disable another platform admin listed in `PLATFORM_ADMIN_EMAILS`.
- An archived item can no longer be edited or moved, even by a direct request.
- A malformed link (an ID that does not exist in any form) or a huge page number now shows "Page introuvable" or the last page instead of a server error.

### Security

- Visitors who are not signed in no longer create a stored session: their form token stays in the session cookie, and expired sessions and sign-in links are purged every hour.
- Signing in now issues a new form (CSRF) token and drops everything kept from before sign-in.
- E-mail sending is rate-limited: 5 sign-in or sign-up e-mails per address per hour, 20 sign-in or sign-up forms per network in 15 minutes, 10 contact messages and 5 requests to the admins per person per day; admins get at most 5 notifications per hour for each kind of request.
- Signing in or signing up answers in the same time whether or not the address has an account; the e-mails are sent after the answer.
- Signing up again with a rejected address no longer puts it back in the admin queue: the person is e-mailed to sign in and re-apply from their account page.
- Every response carries browser security headers: a script-free Content-Security-Policy that forbids framing, nosniff, a same-origin referrer policy, and HSTS when the app is served over https.
- The application refuses to start in production with the example session secret from `.env.example`.
- The item history no longer shows who wrote to the owner through the contact form.
- A message to a collectif is e-mailed to each responsible separately, so they no longer see each other's address.
- The phone of a person whose account is disabled is no longer shown on their items.

<!-- Compare links, one per release:
[Unreleased]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.(Z-1)...vX.Y.Z
-->

[Unreleased]: https://github.com/CollectiFrog/InventAssos/compare/v0.6.1...HEAD
[0.6.1]: https://github.com/CollectiFrog/InventAssos/releases/tag/v0.6.1
