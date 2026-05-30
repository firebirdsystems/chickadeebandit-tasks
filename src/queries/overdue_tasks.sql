SELECT
  t.id,
  t.title,
  t.assignee_id,
  t.due_date,
  t.priority,
  t.labels,
  t.list_id,
  l.name AS list_name,
  (CURRENT_DATE - t.due_date::date) AS days_overdue
FROM tasks t
LEFT JOIN lists l
  ON l.id = t.list_id
  AND l.household_id = t.household_id
WHERE t.household_id = current_setting('app.household_id', true)::uuid
  AND t.completed = 0
  AND t.due_date IS NOT NULL
  AND t.due_date::date < CURRENT_DATE
  AND t.parent_id IS NULL
ORDER BY t.due_date ASC
LIMIT 100
