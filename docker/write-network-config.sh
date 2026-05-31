#!/bin/sh
# Generate the network sub-plugin's browser runtime config into sibyl's baked
# dist, so it can be set via docker-compose (or a .env) without rebuilding the
# image. Run from the trex service entrypoint before the server starts.
#
# The browser plugin only needs `proxyUrl` — the same-origin base of the
# network-api trex function plugin, which holds the site's machine secret
# server-side and proxies to the central API. There is no in-browser Cognito
# login. If NETWORK_PROXY_URL is unset the plugin defaults to its conventional
# same-origin mount (<origin>/plugins/network-api/network-api), so this script
# normally writes an empty object.
#
# (The machine credentials — NETWORK_MACHINE_CLIENT_ID / NETWORK_CLIENT_SECRET /
# NETWORK_COGNITO_DOMAIN / NETWORK_API_URL — are consumed server-side by the
# network-api function via trex.functions.env and are NEVER written here.)
set -eu

CONFIG_JS="/usr/src/plugins/sibyl/dist/config/network-config.js"
[ -d "$(dirname "$CONFIG_JS")" ] || exit 0

{
  printf 'window.__networkPluginConfig = {'
  if [ -n "${NETWORK_PROXY_URL:-}" ]; then
    printf '"proxyUrl":"%s"' "$NETWORK_PROXY_URL"
  fi
  printf '};\n'
} > "$CONFIG_JS"

echo "[write-network-config] wrote $CONFIG_JS"
