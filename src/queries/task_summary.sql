SELECT
  l.name                                                    AS list_name,
  COUNT(*)                                                  AS total,
  COUNT(*) FILTER (WHERE t.completed = 0)                  AS open,
  COUNT(*) FILTER (WHERE t.completed = 1)                  AS done,
  COUNT(*) FILTER (WHERE t.completed = 0
    AND t.due_date IS NOT NULL
    AND date(t.due_date) < CURRENT_DATE)                   AS overdue,
  COUNT(*) FILTER (WHERE t.completed = 0
    AND t.due_date IS NOT NULL
    AND date(t.due_date) = CURRENT_DATE)                   AS due_today
FROM app_tasks__tasks t
LEFT JOIN app_tasks__lists l
  ON l.id = t.list_id
WHERE t.parent_id IS NULL
GROUP BY l.id, l.name
ORDER BY l.name NULLS LAST
