SELECT
  t.id,
  t.title,
  t.assignee_id,
  t.due_date,
  t.priority,
  t.labels,
  t.list_id,
  l.name AS list_name,
  CAST(julianday('now') - julianday(t.due_date) AS INTEGER) AS days_overdue
FROM app_tasks__tasks t
LEFT JOIN app_tasks__lists l
  ON l.id = t.list_id
WHERE t.completed = 0
  AND t.due_date IS NOT NULL
  AND date(t.due_date) < CURRENT_DATE
  AND t.parent_id IS NULL
ORDER BY t.due_date ASC
LIMIT 100
