// Which site is built: DOCS_SITE env var, else the npm script name ("build:dev" → dev).
// Works the same on Windows, macOS and Linux (no "VAR=x cmd" syntax needed).
const fromScript = process.env.npm_lifecycle_event?.endsWith(':dev') ? 'dev' : 'user';
export const site = process.env.DOCS_SITE === 'dev' || process.env.DOCS_SITE === 'user' ? process.env.DOCS_SITE : fromScript;
