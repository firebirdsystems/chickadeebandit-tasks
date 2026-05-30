UPDATE tasks
SET
  completed    = 1,
  completed_at = NOW()::text,
  updated_at   = NOW()::text
WHERE id           = $1
  AND household_id = current_setting('app.household_id', true)::uuid
  AND completed    = 0
