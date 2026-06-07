-- Key/value application settings for the Sibyl host (e.g. the OHDSI WebAPI URL).
CREATE TABLE IF NOT EXISTS notebook.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
