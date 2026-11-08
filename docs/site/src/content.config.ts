// Sources stay at readable paths (docs/user, docs/dev, docs/adr), not inside this app.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { site } from '../site.config.mjs';

const pattern = '**/[^_]*.{md,mdx}';

// Dev site = docs/dev + docs/adr (served under /adr/); user site = docs/user.
const loader =
  site === 'dev'
    ? glob({
        base: '..',
        pattern: [`dev/${pattern}`, `adr/${pattern}`],
        generateId: ({ entry }) => entry.replace(/\.mdx?$/, '').replace(/^dev\//, '').toLowerCase(),
      })
    : glob({ base: '../user', pattern });

export const collections = {
  docs: defineCollection({ loader, schema: docsSchema() }),
};
