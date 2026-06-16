UPDATE app_tasks__tasks
SET
  completed    = 1,
  completed_at = datetime('now'),
  updated_at   = datetime('now')
WHERE id           = $1
  AND completed    = 0
