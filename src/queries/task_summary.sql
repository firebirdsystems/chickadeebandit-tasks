SELECT
  -- due_date is a household-local calendar date, so "overdue" and "due today"
  -- must be measured against :today, which the hub binds to the household's
  -- local date. CURRENT_DATE is UTC and miscounts both for part of every day.
  l.name                                                    AS list_name,
  COUNT(*)                                                  AS total,
  SUM(CASE WHEN t.completed = 0 THEN 1 ELSE 0 END)          AS open,
  SUM(CASE WHEN t.completed = 1 THEN 1 ELSE 0 END)          AS done,
  SUM(CASE WHEN t.completed = 0
    AND t.due_date IS NOT NULL
    AND date(t.due_date) < :today THEN 1 ELSE 0 END)  AS overdue,
  SUM(CASE WHEN t.completed = 0
    AND t.due_date IS NOT NULL
    AND date(t.due_date) = :today THEN 1 ELSE 0 END)  AS due_today
FROM app_tasks__tasks t
LEFT JOIN app_tasks__lists l
  ON l.id = t.list_id
WHERE t.parent_id IS NULL
GROUP BY l.id, l.name
ORDER BY (l.name IS NULL), l.name
