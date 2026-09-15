#!/bin/sh
#
# Container entrypoint for acore-manager.
#
# Bootstraps the database and applies migrations, then starts the SvelteKit
# server produced by @sveltejs/adapter-node.
#
# The migration step is idempotent (CREATE DATABASE IF NOT EXISTS plus Drizzle's
# `__drizzle_migrations` journal), so restarting the container is a no-op.
set -e

echo "[entrypoint] Bootstrapping database and applying migrations..."
node /app/migrate.mjs

echo "[entrypoint] Starting acore-manager..."
exec node /app/build/index.js
