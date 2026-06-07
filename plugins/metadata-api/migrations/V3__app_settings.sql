-- Key/value application settings for the Sibyl host (e.g. the OHDSI WebAPI URL).
-- created_at is intentionally omitted: this is an upsert-only settings store, so
-- only the last-write timestamp (updated_at) is meaningful.
CREATE TABLE IF NOT EXISTS notebook.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
