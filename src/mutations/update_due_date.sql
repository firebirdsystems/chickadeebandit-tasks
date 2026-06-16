UPDATE app_tasks__tasks
SET
  due_date   = $2,
  updated_at = datetime('now')
WHERE id           = $1
