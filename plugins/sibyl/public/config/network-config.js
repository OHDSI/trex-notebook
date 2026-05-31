// Runtime config for the network sub-plugin (Cognito Authorization Code + PKCE,
// public client — no client secret). This default is intentionally empty: the
// plugin then falls back to its own defaults (e.g. redirectUri from the page
// origin) and its Cognito auth stays inactive until configured.
//
// In the trex stack this file is REGENERATED at container start from the
// NETWORK_* env vars on the trex service (see docker-compose.yml and
// docker/write-network-config.sh), so values can be set without rebuilding.
window.__networkPluginConfig = {};
