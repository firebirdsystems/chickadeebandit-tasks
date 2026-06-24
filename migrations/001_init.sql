CREATE TABLE IF NOT EXISTS app_tasks__lists (
  id           TEXT NOT NULL,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#4f46e5',
  member_id    TEXT,
  sort_order   INTEGER DEFAULT 0,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS app_tasks__tasks (
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
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS app_tasks__idx_lists_member_sort
  ON app_tasks__lists(member_id, sort_order, created_at);

CREATE INDEX IF NOT EXISTS app_tasks__idx_tasks_assignee_parent_due
  ON app_tasks__tasks(assignee_id, parent_id, completed, due_date, priority, created_at);

CREATE INDEX IF NOT EXISTS app_tasks__idx_tasks_list
  ON app_tasks__tasks(list_id);

CREATE INDEX IF NOT EXISTS app_tasks__idx_tasks_parent
  ON app_tasks__tasks(parent_id);
