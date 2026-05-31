INSERT INTO tasks (
  id,
  household_id,
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
  gen_random_uuid()::text,
  current_setting('app.household_id', true)::uuid,
  $2,
  $1,
  '',
  $3,
  $4,
  COALESCE($5, 0),
  '[]',
  0,
  'ai',
  NOW()::text,
  NOW()::text
)
