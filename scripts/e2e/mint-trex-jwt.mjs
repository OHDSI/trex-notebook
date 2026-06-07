#!/usr/bin/env node
// Mint a short-lived HS256 JWT accepted by trex's verifyAccessToken().
//
// Key derivation: trex derives its JWT signing key via HKDF from TREX_ROOT_KEY
// (label "trex.jwt.hs256.v1"), then base64-encodes the 32-byte output as a
// plain string. That string IS AUTH_JWT_SECRET in derived.env.  trex's
// hmacSign() calls TextEncoder.encode(secret) — i.e. the UTF-8 bytes of the
// base64 string are the HMAC key, NOT the decoded bytes.  We do exactly the
// same here.
//
// Usage:
//   node scripts/e2e/mint-trex-jwt.mjs [path-to-derived.env]
//   Prints the raw JWT (no newline) so callers can: TOKEN=$(node ...)

import { createHmac, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const envPath = process.argv[2] || 'secrets/derived.env'
const env = readFileSync(envPath, 'utf8')

// AUTH_JWT_SECRET is the HKDF-derived key, base64-encoded.
// trex's hmacSign uses it as a raw UTF-8 string (encoder.encode(secret)),
// so we pass it as-is (not decoded) to createHmac.
const secret = (env.match(/^AUTH_JWT_SECRET=(.*)$/m) || [])[1]?.trim()
if (!secret) {
  console.error('AUTH_JWT_SECRET not found in', envPath)
  process.exit(1)
}

// base64url encode a Buffer or string
function b64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const now = Math.floor(Date.now() / 1000)

// Claim shape must match AccessTokenClaims in trex/core/server/auth/jwt.ts:
//   sub, role, aud, iss, exp, iat, email, app_metadata, user_metadata, session_id
// The pluginAuthz middleware allows admin if app.user_role === "admin",
// which comes from claims.app_metadata.trex_role (set in auth-context.ts).
// The iss must match BETTER_AUTH_URL + BASE_PATH + "/auth/v1"
// (docker-compose: BETTER_AUTH_URL=http://localhost:8011/trex, BASE_PATH=/trex)
// -> "http://localhost:8011/trex/auth/v1"
const header  = { alg: 'HS256', typ: 'JWT' }
const payload = {
  sub:           'e2e-admin',
  role:          'authenticated',
  aud:           'authenticated',
  iss:           'http://localhost:8011/trex/auth/v1',
  exp:           now + 3600,
  iat:           now,
  email:         'e2e@localhost',
  app_metadata:  { provider: 'email', providers: ['email'], trex_role: 'admin' },
  user_metadata: { name: 'e2e' },
  session_id:    randomUUID(),
}

const headerEnc  = b64url(JSON.stringify(header))
const payloadEnc = b64url(JSON.stringify(payload))
const data = `${headerEnc}.${payloadEnc}`

// HMAC key = UTF-8 bytes of the AUTH_JWT_SECRET string (mirrors encoder.encode(secret))
const sig = createHmac('sha256', Buffer.from(secret, 'utf8'))
  .update(data)
  .digest('base64')
  .replace(/=+$/, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

process.stdout.write(`${data}.${sig}`)
