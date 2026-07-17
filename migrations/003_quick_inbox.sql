-- Quick-add inbox: an un-policied, household-shared capture table for the
-- kiosk PIN-free quick-add lane (manifest.kiosk_quick_add). The kiosk can only
-- append here ("add"), never remove — removal happens in-app when a signed-in
-- member triages a capture into a real (owner_only) task or dismisses it.
-- Deliberately NOT row-policied: the ambient kiosk identity has no member id,
-- and owner_only inserts fail closed without one. title_normalized carries a
-- UNIQUE constraint so repeat quick-adds dedupe (ON CONFLICT DO NOTHING).
CREATE TABLE IF NOT EXISTS app_tasks__inbox (
  id               TEXT NOT NULL,
  title            TEXT NOT NULL,
  title_normalized TEXT NOT NULL UNIQUE,
  added_by_id      TEXT,
  added_by_name    TEXT,
  created_at       TEXT,
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_tasks__idx_inbox_created
  ON app_tasks__inbox(created_at);
