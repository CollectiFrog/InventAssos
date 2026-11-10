---
name: remix
description: How to find Remix 3 documentation and follow this app's Remix structure (routes, router, controllers, data modules, tests). Use before writing or changing any app code.
---

# Remix 3 in InventAssos

Remix 3 is **not** React, Remix v2 or React Router. Never write hooks, loaders, `useState`,
`<Outlet>` or file-based routes.

## Find the docs that match the installed version

1. `node_modules/remix/INDEX.md` lists every guide and package README for the installed version.
   Search it: `grep -i session node_modules/remix/INDEX.md`.
2. Read the guide (`node_modules/remix/guides/*.md`), then the package README
   (`node_modules/remix/src/<package>/README.md`).
3. Check exact signatures in the types: `node_modules/@remix-run/<package>/dist/**/*.d.ts`.
4. <https://remix.run> and <https://api.remix.run> mirror the same content online.

## Where code goes

| Need                   | Put it in                                                          |
|------------------------|--------------------------------------------------------------------|
| a URL                  | `app/routes.ts` (use `routes.x.href()` everywhere, never a string) |
| a page or form handler | `app/actions/<area>/controller.tsx`, mapped in `app/router.ts`     |
| markup                 | a component next to its controller (`*-page.tsx`) or `app/ui/`     |
| SQL                    | `app/data/<entity>.ts`, nowhere else                               |
| a request-wide value   | a middleware in `app/middleware/`, added to `appMiddleware()`      |
| a schema change        | a new `db/migrations/NNNN_slug/up.sql`                             |

## Components

A component is `function Name(handle: Handle<Props>) { return () => <jsx/> }`: setup once, then a
render function. Read props from `handle.props` inside render. Pages render inside `<Layout>`.
Attributes are HTML names (`class`, `for` → use `htmlFor`). No client JavaScript (ADR 0015).

## Tests

Router tests: build `createAppRouter({ db, ... })` with `openTestDatabase()` from `test/`, send a
`Request` built with `routes.x.href()`, assert on the `Response`. See ADR 0012.
