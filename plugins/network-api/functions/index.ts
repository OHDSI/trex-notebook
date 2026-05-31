// @ts-nocheck - Deno edge function, runs in trex's EdgeRuntime (not tsc-compiled)
//
// Site machine-auth proxy. Holds the per-site Cognito *confidential* client
// (client_id + client_secret) in server-side env and reverse-proxies the
// browser network plugin's calls to the Central Serverless API, attaching a
// machine (client-credentials) bearer token. The secret AND the machine token
// stay inside this worker — the browser only ever sees the proxied response.
//
// Mounted by trex at  <PLUGINS_BASE_PATH>/<scope>/network-api/*  (see the
// `trex.functions.api` entry in package.json). Everything after `/network-api`
// is forwarded verbatim to NETWORK_CENTRAL_API_URL.
//
// Env (injected via trex.functions.env from the trex service):
//   NETWORK_MACHINE_CLIENT_ID  per-site Cognito *confidential* client id     (required)
//   NETWORK_CLIENT_SECRET      per-site Cognito *confidential* client secret (required)
//   NETWORK_COGNITO_DOMAIN     e.g. https://<pool>.auth.<region>.amazoncognito.com (required)
//   NETWORK_CENTRAL_API_URL    central API base, e.g. https://abc.execute-api...  (required)
//   NETWORK_TOKEN_SCOPE        optional client-credentials scope
//
// NOTE: the machine client id is DISTINCT from the browser's human-login
// client (NETWORK_CLIENT_ID = the shared public SitePluginClient). This worker
// uses the per-site confidential client that carries a secret.

const PREFIX = "/network-api";

function env(name: string): string {
  return (Deno.env.get(name) ?? "").trim();
}

function json(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// --- machine token cache (module scope, per worker) ---------------------------
let cachedToken: string | null = null;
let cachedExpiryMs = 0;

async function getMachineToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedExpiryMs) return cachedToken;

  const domain = env("NETWORK_COGNITO_DOMAIN").replace(/\/+$/, "");
  const clientId = env("NETWORK_MACHINE_CLIENT_ID");
  const clientSecret = env("NETWORK_CLIENT_SECRET");
  const scope = env("NETWORK_TOKEN_SCOPE");

  const body = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) body.set("scope", scope);

  // Confidential client → HTTP Basic auth (Cognito convention). btoa is fine
  // for ASCII client ids/secrets.
  const basic = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${basic}`,
    },
    body,
  });

  if (!res.ok) {
    // Do NOT include the upstream body — it can echo client config. Status only.
    throw new Error(`cognito token endpoint returned ${res.status}`);
  }

  const data = await res.json();
  const token = data.access_token as string | undefined;
  const expiresIn = Number(data.expires_in ?? 0);
  if (!token) throw new Error("cognito response missing access_token");

  cachedToken = token;
  // Refresh ~60s before expiry; floor at 30s so a tiny/absent expires_in still caches briefly.
  cachedExpiryMs = now + Math.max(30, expiresIn - 60) * 1000;
  return token;
}

Deno.serve(async (req: Request) => {
  // 1. Config gate
  for (const v of ["NETWORK_MACHINE_CLIENT_ID", "NETWORK_CLIENT_SECRET", "NETWORK_COGNITO_DOMAIN", "NETWORK_CENTRAL_API_URL"]) {
    if (!env(v)) {
      return json(503, "NOT_CONFIGURED", `network-api is not configured (${v} unset)`);
    }
  }

  // 2. Auth gate — trex injects x-user-id for authenticated callers. Only
  //    logged-in site operators may drive the machine proxy.
  if (!req.headers.get("x-user-id")) {
    return json(401, "UNAUTHENTICATED", "authentication required");
  }

  // 3. Compute the central sub-path: everything after `/network-api`.
  const url = new URL(req.url);
  const idx = url.pathname.indexOf(PREFIX);
  if (idx === -1) {
    return json(404, "NOT_FOUND", "request did not match the network-api mount");
  }
  const subPath = url.pathname.slice(idx + PREFIX.length) || "/";
  const base = env("NETWORK_CENTRAL_API_URL").replace(/\/+$/, "");
  const target = `${base}${subPath}${url.search}`;

  // 4. Machine token
  let machineToken: string;
  try {
    machineToken = await getMachineToken();
  } catch (_e) {
    return json(502, "TOKEN_EXCHANGE_FAILED", "could not obtain machine token");
  }

  // 5. Proxy to central. Forward only a safe header subset; the machine token
  //    replaces any caller Authorization.
  const fwdHeaders: Record<string, string> = { authorization: `Bearer ${machineToken}` };
  const ct = req.headers.get("content-type");
  if (ct) fwdHeaders["content-type"] = ct;
  const accept = req.headers.get("accept");
  if (accept) fwdHeaders["accept"] = accept;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: fwdHeaders,
      body: hasBody ? await req.arrayBuffer() : undefined,
    });
  } catch (_e) {
    return json(502, "UPSTREAM_UNREACHABLE", "central API request failed");
  }

  // Pass status + body + content-type straight through so the UI sees real
  // central errors. Strip hop-by-hop / encoding headers.
  const respHeaders: Record<string, string> = {};
  const uct = upstream.headers.get("content-type");
  if (uct) respHeaders["content-type"] = uct;
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
});
