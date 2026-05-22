CREATE TABLE IF NOT EXISTS lists (
  household_id UUID NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT NOT NULL,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#4f46e5',
  member_id    TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (household_id, id)
);

CREATE TABLE IF NOT EXISTS tasks (
  household_id UUID NOT NULL DEFAULT current_setting('app.household_id', true)::uuid,
  id           TEXT NOT NULL,
  list_id      TEXT,
  title        TEXT NOT NULL,
  notes        TEXT DEFAULT '',
  assignee_id  TEXT,
  due_date     TEXT,
  due_time     TEXT,
  priority     INTEGER DEFAULT 0,
  labels       TEXT DEFAULT '[]',
  recurrence   TEXT,
  completed    INTEGER DEFAULT 0,
  completed_at TEXT,
  parent_id    TEXT,
  created_by   TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (household_id, id)
);
