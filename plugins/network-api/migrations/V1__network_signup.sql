-- Single-row store for this node's site identity + machine credentials.
-- A node is exactly one site, so the table is pinned to id = 1.
CREATE SCHEMA IF NOT EXISTS network;

CREATE TABLE IF NOT EXISTS network.site_credential (
    id                INT PRIMARY KEY DEFAULT 1,
    site_id           TEXT,
    claim_token       TEXT,
    cognito_client_id TEXT,
    client_secret_enc TEXT,            -- base64(AES-GCM(iv ++ ct ++ tag)); never plaintext
    status            TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'active'
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT site_credential_singleton CHECK (id = 1)
);
