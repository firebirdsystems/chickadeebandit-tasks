INSERT INTO app_tasks__tasks (
  id,
  list_id,
  title,
  notes,
  assignee_id,
  due_date,
  priority,
  labels,
  completed,
  created_by,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  $2,
  $1,
  '',
  $3,
  $4,
  COALESCE($5, 0),
  '[]',
  0,
  'ai',
  datetime('now'),
  datetime('now')
)
