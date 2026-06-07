#!/usr/bin/env bash
# trex-sql.sh — authenticated SQL transport to the running trex stack.
#
# Usage: ./scripts/e2e/trex-sql.sh "SELECT 1 AS ok"
#
# Route: POST /trex/pg/v1/query  (Supabase-compatible pg-meta endpoint)
# Auth:  HS256 JWT minted from AUTH_JWT_SECRET (derived from TREX_ROOT_KEY via HKDF),
#        validated by trex's verifyAccessToken() using Bearer token in Authorization header.
#
# NOTE (2026-06-06): The pg-meta worker in this image is broken — the Deno edge
# runtime worker fails to load libpg-query.wasm (file missing from build cache),
# so every request returns HTTP 500 with a WASM error.  The authentication layer
# IS working correctly: the JWT is accepted before the request reaches the worker.
# This is a container build artefact, not an auth issue.
#
# The trex-sql.sh is retained as the canonical auth+transport script for when
# the pg-meta worker is repaired (rebuild with the WASM present in the image).
set -euo pipefail

SQL="$1"
SECRETS="${2:-secrets/derived.env}"
TOKEN="$(node scripts/e2e/mint-trex-jwt.mjs "${SECRETS}")"

curl -s -X POST "http://localhost:8011/trex/pg/v1/query" \
  -H "authorization: Bearer ${TOKEN}" \
  -H "content-type: application/json" \
  -d "$(jq -nc --arg q "$SQL" '{query:$q}')"
echo
