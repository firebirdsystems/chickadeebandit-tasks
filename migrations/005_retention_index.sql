-- Retention needs an index LEADING with the timestamp column: the hub's daily
-- runner both counts and pages the expiring batch with
-- `WHERE completed_at < ? ORDER BY completed_at ASC LIMIT ?`, and admission
-- refuses a retain_days declaration without one.
--
-- The existing assignee/parent/completed index cannot serve it — completed_at
-- is not in it at all, and the columns ahead of it there make it useless as a
-- range scan over completion time.
--
-- `id` trails the timestamp so the paging SELECT (which returns the id of every
-- expiring row) is covered and never touches the table.
--
-- Open tasks have completed_at NULL and `NULL < ?` is NULL, so they are never
-- eligible for the sweep — retention only ever removes tasks that were finished
-- and then left alone for the full window.
CREATE INDEX IF NOT EXISTS app_tasks__idx_tasks_completed_at
  ON app_tasks__tasks(completed_at, id);
