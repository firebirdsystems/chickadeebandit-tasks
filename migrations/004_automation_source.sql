-- Automations create tasks on a member's behalf (manifest.automation_actions.create_task).
--
-- `source_event_id` records which app event produced the row. The dispatcher's
-- dedupe guard reads it before running an action (SELECT 1 ... WHERE
-- source_event_id = ? LIMIT 1), so one event can never be applied twice —
-- neither by a retry nor by two rules pointed at the same trigger.
--
-- Nullable on purpose: every task the app's own UI creates leaves it NULL.
ALTER TABLE app_tasks__tasks ADD COLUMN source_event_id TEXT;

CREATE INDEX IF NOT EXISTS app_tasks__idx_tasks_source_event_id
  ON app_tasks__tasks(source_event_id);
