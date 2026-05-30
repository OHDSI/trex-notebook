# network-plugin

Site-facing trex UI plugin for federated network studies. Vue + Vuetify single-spa, built to
SystemJS (mirrors `plugins/strategus`). It authenticates to the central API via Cognito
(Authorization Code + PKCE), **independent of trex's own login**, and talks only to the central
HTTP API.

## Develop

    npm install
    npm run dev        # standalone dev harness at http://localhost:5173

## Build (into the sibyl host)

    npm run build      # writes ../sibyl/public/plugins/network-plugin/index.system.js

Register it in sibyl's `public/config/plugins.json` with a route under `/plugins/network/`
(same mechanism as the strategus plugin).

## Runtime config

The host injects `window.__networkPluginConfig` with `{ apiUrl, cognitoDomain, clientId,
redirectUri }`. For standalone dev, set `VITE_API_URL`, `VITE_COGNITO_DOMAIN`,
`VITE_COGNITO_CLIENT_ID`, `VITE_REDIRECT_URI`. The `clientId` is the `SitePluginClientId` stack
output from the Central Serverless API deploy; add `${pluginUrl}/plugins/network/callback` to
that Cognito client's callback URLs.

## Test

    npm run test:run   # vitest unit
    npm run test:e2e   # playwright mount smoke
