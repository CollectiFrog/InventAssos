---
title: Mon compte, lighter settings (study)
description: "Why Mon compte feels heavy, what recent products do with small settings pages, and four options."
sidebar:
  order: 2
---

Study requested on 2026-11-18 after field feedback: Mon compte (`/compte/profil`) is "too heavy and
too full of information; four columns is heavy". Status: **proposed**, no code changed. The visual
version, with mock-ups of each option, is the claude.ai page
<https://claude.ai/artifact/2hDy2mbDMM9bGudDcdo6mg>.

## What the page does today

Checked in `app/actions/account/profile/profile-page.tsx` and `public/styles.css` (`.settings*`):

- On a computer (container ≥ 56rem), the page lays out **four columns**: the app sidebar, an
  in-page table of contents (8 anchors), then each section as "title + explanation | controls".
  On phones, the table of contents becomes a block of wrapping pills and explanations are hidden
  (ADR 0031).
- Each section says things twice: an explanation on the left and a status sentence on the right
  ("Vous n'avez pas encore de mot de passe.").
- Five of eight sections hold one sentence and one button (Administration, Mot de passe, Session,
  À propos, Supprimer). Only Profil is a form; Apparence is a three-way switch.
- Duplicates: the theme switch is also at the foot of the sidebar; the count of pending requests is
  also on the home page (ADR 0030).

### Docs and code disagree

1. `ui.md` says the Settings template is used by "Mon compte, Administration". Administration uses
   tabs (`app/actions/admin/admin-tabs.tsx`); only Mon compte uses `.settings`.
2. `ui.md` lists an "Info bubble" component (`<details>` ⓘ); there is none in `app/ui/`.
3. "Mes collectifs" is explained as "collectifs you are responsible for", while its empty state
   says "you are not part of any collectif".

## References (2024-2026)

Screens behind a sign-in were not seen directly: descriptions come from official docs, press, or
text descriptions in galleries (saasframe, saasui). Mobbin refused access.

| Product                | Layout                                                                                     | Takeaway                                                 |
|------------------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------|
| Google Account (2025)  | icon rail, content in "a single, narrower column"; one row per datum, edit on a sub-page   | one bounded column; summary then edit                    |
| Claude.ai              | 220 px nav, frameless content; sign out and delete as flat rows "sentence \| small button" | closest to our one-button sections                       |
| Android settings guide | list or list-detail; sub-screens from ~15 settings; max width on large screens             | show the setting's **state**, not a description; no About |
| GOV.UK summary list    | `<dl>` rows key · value · action                                                           | accessible, script-free semantics for status rows        |
| Linear                 | own settings sidebar (Account, Features, Administration, Teams); rows "name \| control"    | a dedicated nav only pays off with many pages            |
| Vercel                 | stacked cards, each with its own save footer; red-bordered delete card                     | heavy frames, what ADR 0031 removed                      |
| GitHub (Primer)        | nav list of settings *pages*; danger zone last                                             | destructive last, as we do                               |
| Stripe, Notion         | personal account (details, password, sessions, delete) on **one page**                     | our scope fits one page                                  |
| Apple iOS / macOS      | inset grouped lists, label left, control right                                             | on wide screens the label-value gap hurts: cap the width |
| Slack, Figma, Raycast  | tabbed windows or modals, search in settings                                               | built for dozens of settings; not our case               |

Sources:

- <https://9to5google.com/2025/11/28/google-account-web-redesign/>
- <https://www.saasframe.io/examples/claude-account-settings>
- <https://developer.android.com/design/ui/mobile/guides/patterns/settings>
- <https://design-system.service.gov.uk/components/summary-list/>
- <https://linear.app/docs/account-preferences.md>
- <https://www.saasframe.io/examples/vercel-account-settings>
- <https://primer.style/product/scenario-patterns/delete>
- <https://docs.stripe.com/dashboard/basics>
- <https://www.notion.com/help/account-settings>
- <https://mjtsai.com/blog/?p=39561>
- <https://www.saasui.design/blog/saas-settings-page-ux-patterns>
- <https://www.saasframe.io/blog/saas-settings-page-design-examples>

## What makes a small settings page lighter

- **Drop the in-page table of contents.** Products with settings navigation use it to reach other
  pages, never as anchors in a short page. One column less on computers, no pills on phones.
- **Show state instead of explanations.** "Mot de passe · Défini", "3 demandes en attente".
- **One column of about 40rem.** The action stays next to its label; on phones the same row wraps.
- **De-duplicate.** À propos (version, guide) becomes a footer line; Apparence fits on one row.

Not worth it for eight sections: settings navigation, tabs, search in settings, an overview page.

## Options

- **A. One column: the form, then rows (recommended).** Profil stays an in-place form at the top;
  every other section becomes a flat row "label · state | action", danger last, À propos as footer.
  Four columns become two; no new route. Cost: low (`profile-page.tsx`, ~70 lines of CSS removed and
  ~25 added, `settings.test.ts`, `app/ui/navigation.test.ts`, `ui.md`, user guide, CHANGELOG,
  ADR 0033 amending the Settings template and the ADR 0031 bullet on phone explanations). Keep
  `id="administration"` for `adminBack`.
- **B. Summary list and sub-pages.** The whole page becomes a read-only `<dl>`; name and phone are
  edited on `/compte/profil/modifier`. Calmest, but the most frequent change (phone) costs one more
  page, needs a route, controller and flash, and turns actions into links (against ADR 0031's
  homogeneous buttons). Cost: medium.
- **C. Minimal touch, three columns.** Drop the table of contents; explanations behind an ⓘ
  `<details>`; one-button sections lose their paragraph. Smallest change and creates the missing
  Info bubble, but keeps a title column far from the controls. Cost: low; perceived gain small.
- **D. Inset groups, iOS style.** Rounded blocks Profil / Compte / Danger. Familiar on phones, but
  brings back the frames ADR 0031 removed. Cost: low to medium, plus an ADR amending 0031.

## Open questions

1. Which option? Recommendation: A; B can follow if Mon compte grows past ~15 settings.
2. Administration for staff: right after Profil, with the pending count as its state.
3. Keep Apparence on the page: yes, one row (on phones it exists only here).
4. Drop the explanation sentences: yes, except the phone hint (already behind the field's ⓘ) and a
   short line under deletion.
5. Ship in the current V0.10.x patch with ADR 0033: recommended.

Whatever the option, the same PR fixes the Settings row of `ui.md` (Administration uses tabs).
