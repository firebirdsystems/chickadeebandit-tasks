SELECT
  t.id,
  t.title,
  t.assignee_id,
  t.due_date,
  t.priority,
  t.labels,
  t.list_id,
  l.name AS list_name,
  CAST(julianday(:today) - julianday(t.due_date) AS INTEGER) AS days_overdue
FROM app_tasks__tasks t
LEFT JOIN app_tasks__lists l
  ON l.id = t.list_id
WHERE t.completed = 0
  AND t.due_date IS NOT NULL
-- :today is the household-local date. CURRENT_DATE and 'now' are UTC, and would
-- call a task overdue (or not) up to a day early depending on the timezone.
  AND date(t.due_date) < :today
  AND t.parent_id IS NULL
ORDER BY t.due_date ASC
LIMIT 100
