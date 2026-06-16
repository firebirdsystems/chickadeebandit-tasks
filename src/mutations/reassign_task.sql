UPDATE app_tasks__tasks
SET
  assignee_id = $2,
  updated_at  = datetime('now')
WHERE id           = $1
