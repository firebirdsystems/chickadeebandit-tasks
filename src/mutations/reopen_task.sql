UPDATE tasks
SET
  completed    = 0,
  completed_at = NULL,
  updated_at   = NOW()::text
WHERE id           = $1
  AND household_id = current_setting('app.household_id', true)::uuid
  AND completed    = 1
