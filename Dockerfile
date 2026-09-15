# acore-manager container image.
#
# A single SvelteKit application (no workspaces, no separate client/server
# packages) built with @sveltejs/adapter-node, plus a runtime database
# bootstrap and migration step.
#
# Build from the repository root:
#
#     docker build -t acore-manager .
#
# Required at runtime (see .env.example):
#
#     DATABASE_URL          mysql://user:password@host:3306/database
#     ORIGIN                the public origin the browser uses, e.g. https://manager.example.com
#     BETTER_AUTH_SECRET    32+ characters of high entropy
#     DISCORD_CLIENT_ID     Discord OAuth application id
#     DISCORD_CLIENT_SECRET Discord OAuth application secret
#
# ORIGIN must match the browser-facing URL, or adapter-node will reject
# cross-origin form submissions. No database is needed at image build time.

# ---- Stage 1: build ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install first so the layer cache survives source changes. The lockfile
# requires Node ^20.19 || ^22.13 || >=24 and `.npmrc` sets engine-strict, so the
# base image must satisfy that.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# Build. .dockerignore keeps node_modules, .svelte-kit, .git and .env out of the
# context, so no local secrets reach a layer.
COPY . .
RUN npm run build

# Guarantee the migrations directory exists even before the first migration is
# generated, so the runtime copy below cannot fail.
RUN mkdir -p drizzle

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# node_modules is kept deliberately: migrate.mjs needs drizzle-orm and mysql2 at
# runtime, and this app declares no `dependencies` (adapter-node bundles the
# rest into build/). A production prune would break the migration step.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# adapter-node output, plus the migration tooling used by the entrypoint.
COPY --from=build /app/build ./build
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/migrate.mjs ./migrate.mjs
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
