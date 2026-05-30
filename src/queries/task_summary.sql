SELECT
  l.name                                                    AS list_name,
  COUNT(*)                                                  AS total,
  COUNT(*) FILTER (WHERE t.completed = 0)                  AS open,
  COUNT(*) FILTER (WHERE t.completed = 1)                  AS done,
  COUNT(*) FILTER (WHERE t.completed = 0
    AND t.due_date IS NOT NULL
    AND t.due_date::date < CURRENT_DATE)                   AS overdue,
  COUNT(*) FILTER (WHERE t.completed = 0
    AND t.due_date IS NOT NULL
    AND t.due_date::date = CURRENT_DATE)                   AS due_today
FROM tasks t
LEFT JOIN lists l
  ON l.id = t.list_id
  AND l.household_id = t.household_id
WHERE t.household_id = current_setting('app.household_id', true)::uuid
  AND t.parent_id IS NULL
GROUP BY l.id, l.name
ORDER BY l.name NULLS LAST
