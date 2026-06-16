SELECT
  t.id,
  t.title,
  t.notes,
  t.assignee_id,
  t.due_date,
  t.due_time,
  t.priority,
  t.labels,
  t.list_id,
  l.name AS list_name,
  t.parent_id,
  t.created_by,
  t.created_at,
  t.updated_at
FROM app_tasks__tasks t
LEFT JOIN app_tasks__lists l
  ON l.id = t.list_id
WHERE t.completed = 0
  AND t.parent_id IS NULL
ORDER BY
  t.due_date NULLS LAST,
  t.priority DESC,
  t.created_at
LIMIT 200
