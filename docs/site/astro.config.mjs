// One Starlight app, built twice: DOCS_SITE=user (from main) and DOCS_SITE=dev (from dev).
// See docs/adr/0003-documentation-site.md.
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import { site } from './site.config.mjs';
import { fileURLToPath } from 'node:url';

// CI passes the Pages URL (e.g. https://owner.github.io/repo). Locally: user on :4321, dev on :4322.
const pagesUrl = process.env.DOCS_PAGES_URL?.replace(/\/$/, '');
const userUrl = pagesUrl ?? 'http://localhost:4321';
const devUrl = pagesUrl ? `${pagesUrl}/dev` : 'http://localhost:4322';
const basePath = pagesUrl ? new URL(pagesUrl).pathname.replace(/\/$/, '') : '';
const base = site === 'dev' && pagesUrl ? `${basePath}/dev` : basePath || '/';

// Edit these per project.
const project = {
  name: 'InventAssos',
  repo: 'https://github.com/CollectiFrog/InventAssos',
  lang: 'fr', // language of the user documentation
};

const sites = {
  user: {
    title: project.name,
    sidebar: [
      { label: 'Démarrer', items: [{ autogenerate: { directory: 'guides' } }] },
      { label: 'Référence', items: [{ autogenerate: { directory: 'reference' } }] },
    ],
    otherSite: { label: 'Docs développeurs', href: `${devUrl}/` },
  },
  dev: {
    title: `${project.name} · Developers`,
    sidebar: [
      { label: 'Overview', link: '/' },
      { label: 'Contribute', items: [{ autogenerate: { directory: 'contribute' } }] },
      { label: 'Product', items: [{ autogenerate: { directory: 'product' } }] },
      { label: 'Architecture', items: [{ autogenerate: { directory: 'architecture' } }] },
      { label: 'Decisions (ADR)', items: [{ autogenerate: { directory: 'adr' } }] },
    ],
    otherSite: { label: 'User docs', href: `${userUrl}/` },
  },
};

const current = sites[site];

export default defineConfig({
  site: new URL(userUrl).origin,
  server: { port: site === 'dev' ? 4322 : 4321 },
  // Content lives outside this app (docs/user, docs/dev): let .mdx files import Starlight components.
  vite: {
    resolve: {
      alias: [
        {
          find: /^@astrojs\/starlight\/components$/,
          replacement: fileURLToPath(new URL('./node_modules/@astrojs/starlight/dist/components.ts', import.meta.url)),
        },
      ],
    },
  },
  base,
  outDir: `./dist/${site}`,
  integrations: [
    mermaid({ autoTheme: true }), // must come before starlight
    starlight({
      title: current.title,
      defaultLocale: 'root',
      locales: { root: { label: project.lang, lang: project.lang } },
      social: [{ icon: 'github', label: 'GitHub', href: project.repo }],
      sidebar: [...current.sidebar, { label: `→ ${current.otherSite.label}`, link: current.otherSite.href }],
      // Design system hook: tokens and overrides live in src/styles/.
      customCss: ['./src/styles/tokens.css', './src/styles/theme.css'],
    }),
  ],
});
