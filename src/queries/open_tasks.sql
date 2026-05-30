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
FROM tasks t
LEFT JOIN lists l
  ON l.id = t.list_id
  AND l.household_id = t.household_id
WHERE t.household_id = current_setting('app.household_id', true)::uuid
  AND t.completed = 0
  AND t.parent_id IS NULL
ORDER BY
  t.due_date NULLS LAST,
  t.priority DESC,
  t.created_at
LIMIT 200
