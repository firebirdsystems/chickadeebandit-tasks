-- Index the manifest `preload` read, which the hub runs server-side while
-- rendering this app's document — on every launch, for every household.
--
-- preload.subtasks reads the child tasks out of the shared tasks table, so it
-- visited every task in the household — subtasks and top-level alike — and then
-- sorted them.
--
-- PARTIAL index, and it has to be: a plain (parent_id, created_at) index is not
-- used for `parent_id IS NOT NULL`, which is a range over the whole key space
-- rather than a seek. Matching the WHERE clause in the index predicate instead
-- makes the index contain exactly the subtasks, so the ordering comes free and
-- the index stays small — it holds nothing for the top-level tasks.
CREATE INDEX IF NOT EXISTS app_tasks__tasks_subtask_created_idx
  ON app_tasks__tasks (created_at) WHERE parent_id IS NOT NULL;
