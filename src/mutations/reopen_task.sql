UPDATE app_tasks__tasks
SET
  completed    = 0,
  completed_at = NULL,
  updated_at   = datetime('now')
WHERE id           = $1
  AND completed    = 1
