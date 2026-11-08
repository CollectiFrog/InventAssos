# Production image: ghcr.io/collectifrog/inventassos:X.Y.Z, built by .github/workflows/release.yml.
# Remix 3 runs TypeScript source through remix/node-tsx, so there is no compile stage.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json server.ts ./
COPY app ./app
COPY db/migrations ./db/migrations
COPY public ./public
# The image runs as the unprivileged user shipped with the Node image.
USER node
EXPOSE 3000
CMD ["node", "--import", "remix/node-tsx", "server.ts"]
