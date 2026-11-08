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

<!-- Compare links, one per release:
[Unreleased]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.Z...HEAD
[X.Y.Z]: https://github.com/CollectiFrog/InventAssos/compare/vX.Y.(Z-1)...vX.Y.Z
-->

[Unreleased]: https://github.com/CollectiFrog/InventAssos/commits/dev
