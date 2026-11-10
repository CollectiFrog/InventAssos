---
title: GDPR and legal checklist
description: What must be true before V1.0 is released.
sidebar:
  order: 3
---

V1.0 ships only when every box is ticked. Sources: the
[CNIL guide for associations](https://cnil.fr/sites/cnil/files/atoms/files/cnil-guide_association.pdf)
and the [CNIL page on the record of processing](https://cnil.fr/RGDP-le-registre-des-activites-de-traitement).
A review by someone qualified in law is still advised.

## Framework

- [ ] Controller and publisher named: Collecti'FROG for the proofs of concept, to confirm for V1.0
- [ ] GDPR contact named, with a dedicated address
- [ ] Record of processing kept (CNIL simplified model): accounts, inventory, audit log, e-mails
- [ ] Legal notice: publisher (Collecti'FROG), publication director, host (Tristan, legal host,
      self-hosted; servers maintained by TFGL, informal group without legal entity)
- [ ] Terms of use: rules of use, responsibilities when lending between collectifs

## Information and rights

- [ ] Notice at sign-up: purpose, legal basis, recipients, retention, rights, contact, right to
      complain to the CNIL
- [ ] Phone optional, with a clear notice that validated users can see it
- [ ] Privacy policy reachable from every page
- [ ] In the app: see and export own data, correct it, delete own account
- [ ] Procedure to answer requests within one month

## Data and storage

- [ ] Retention set and applied automatically (data purged 2 to 3 months after account deletion,
      ID only kept in the audit log), backups included
- [ ] Minimisation checked: only the city of locations is visible, no needless data collected
- [ ] Only the session cookie is used: no third-party tracker, no audience measurement
- [ ] Hosting location documented, with a plan if the server stops
- [ ] Processors listed (the collectif's Zimbra mail host in particular) with their data
      protection commitments

## Security

- [ ] HTTPS everywhere; admin access limited and logged
- [ ] Encrypted backups stored off the server; restore tested
- [ ] Dependency updates followed (Dependabot)
- [ ] Data breach procedure: internal register, CNIL notification within 72 h if there is a risk,
      people informed if the risk is high
