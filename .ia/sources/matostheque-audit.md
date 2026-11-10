# Matosthèque code audit

Origin: `gricad-gitlab.univ-grenoble-alpes.fr/duffouvi/matostheque`, branch `latest`, archive read
on 2026-11-06. Presentation: <https://transition-cnrs.sciencesconf.org/data/pages/S4_RAYMOND_1.pdf>.

## Why we do not fork it

- **Proprietary licence** ("Custom Proprietary Software License"): non-commercial research use,
  redistribution only to academic or public research institutions. Never copy its code.
- No notion of organisation: `team` is a free-text field; an owner is one person.
- API open by default (no DRF permission config; `PUT/DELETE /api/materials/<pk>/` unchecked).
- Repository hygiene: virtualenv, `node_modules`, production media (including user photos), logs
  and `.env` committed; config hard-coded in `settings.py`.

## What we take as inspiration (ideas, not code)

| Their feature or lesson                              | Our answer                                  |
|------------------------------------------------------|---------------------------------------------|
| Holder approves loans: removes the "fear of lending" | approval by the holder in V1.4 (booking)    |
| Initial inventory is the main brake                  | CSV / Excel import in V0.10                 |
| QR code per item, public item page                   | V1.2                                        |
| Daily job for overdue loans, e-mail reminders        | scheduled jobs (CronJob) when booking lands |
| One item per loan was limiting                       | multi-item bookings, later                  |
| Items orphaned when their person leaves              | collectif or person ownership (ADR 0009)    |

Stack for reference: Django + DRF, Next.js + MUI front (Devias template, MIT), CAS SSO optional.
