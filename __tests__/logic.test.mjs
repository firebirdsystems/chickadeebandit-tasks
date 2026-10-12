import { describe, it, expect } from "vitest";
import {
  PRIORITY_COLORS, PRIORITY_LABELS, PRIORITY_CLASSES,
  DAYS, DAY_LABELS,
  parseLabels,
  isOverdue, isToday, isTomorrow, isUpcoming, formatDue,
  nextDueDate, sortTasks, searchableFields,
  supervisesTasks, assignableMembers, savedAssigneeId,
  nextOccurrence, taskInsert, taskCreatedPayload, taskCompletedPayload,
} from "../src/logic.js";

const TODAY = "2025-06-15"; // Sunday
const YESTERDAY = "2025-06-14";
const TOMORROW   = "2025-06-16";
const NEXT_WEEK  = "2025-06-22";

function task(overrides = {}) {
  return { id: "t1", completed: null, due_date: null, priority: 0, ...overrides };
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe("PRIORITY constants", () => {
  it("covers all four priority levels", () => {
    for (const p of [0, 1, 2, 3]) {
      expect(PRIORITY_COLORS[p]).toBeTruthy();
      expect(PRIORITY_LABELS[p]).toBeTruthy();
      expect(PRIORITY_CLASSES[p]).toBeTruthy();
    }
  });

  it("DAYS has 7 entries matching expected weekday abbreviations", () => {
    expect(DAYS).toHaveLength(7);
    expect(DAYS[0]).toBe("sun");
    expect(DAYS[6]).toBe("sat");
    expect(DAY_LABELS).toHaveLength(7);
  });
});

// ── parseLabels ───────────────────────────────────────────────────────────────

describe("parseLabels", () => {
  it("parses a valid JSON array string", () => {
    expect(parseLabels('["urgent","bug"]')).toEqual(["urgent", "bug"]);
  });

  it("returns empty array for null or empty string", () => {
    expect(parseLabels(null)).toEqual([]);
    expect(parseLabels("")).toEqual([]);
    expect(parseLabels(undefined)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseLabels("not-json")).toEqual([]);
    expect(parseLabels("{broken")).toEqual([]);
  });
});

// ── isOverdue ─────────────────────────────────────────────────────────────────

describe("isOverdue", () => {
  it("returns true when due date is before today", () => {
    expect(isOverdue(task({ due_date: YESTERDAY }), TODAY)).toBe(true);
  });

  it("returns false when due today", () => {
    expect(isOverdue(task({ due_date: TODAY }), TODAY)).toBe(false);
  });

  it("returns false when due in the future", () => {
    expect(isOverdue(task({ due_date: TOMORROW }), TODAY)).toBe(false);
  });

  it("returns false when completed, even if past due", () => {
    expect(isOverdue(task({ due_date: YESTERDAY, completed: "2025-06-10T10:00:00Z" }), TODAY)).toBe(false);
  });

  it("returns false when no due date", () => {
    expect(isOverdue(task({ due_date: null }), TODAY)).toBe(false);
  });
});

// ── isToday ───────────────────────────────────────────────────────────────────

describe("isToday", () => {
  it("returns true when due date matches today", () => {
    expect(isToday(task({ due_date: TODAY }), TODAY)).toBe(true);
  });

  it("returns false for yesterday or tomorrow", () => {
    expect(isToday(task({ due_date: YESTERDAY }), TODAY)).toBe(false);
    expect(isToday(task({ due_date: TOMORROW }), TODAY)).toBe(false);
  });

  it("returns false when no due date", () => {
    expect(isToday(task({ due_date: null }), TODAY)).toBe(false);
  });
});

// ── isTomorrow ────────────────────────────────────────────────────────────────

describe("isTomorrow", () => {
  it("returns true when due date is the day after today", () => {
    expect(isTomorrow(task({ due_date: TOMORROW }), TODAY)).toBe(true);
  });

  it("returns false for today or later this week", () => {
    expect(isTomorrow(task({ due_date: TODAY }), TODAY)).toBe(false);
    expect(isTomorrow(task({ due_date: NEXT_WEEK }), TODAY)).toBe(false);
  });
});

// ── isUpcoming ────────────────────────────────────────────────────────────────

describe("isUpcoming", () => {
  it("returns true when due date is in the future", () => {
    expect(isUpcoming(task({ due_date: TOMORROW }), TODAY)).toBe(true);
    expect(isUpcoming(task({ due_date: NEXT_WEEK }), TODAY)).toBe(true);
  });

  it("returns false when overdue or due today", () => {
    expect(isUpcoming(task({ due_date: YESTERDAY }), TODAY)).toBe(false);
    expect(isUpcoming(task({ due_date: TODAY }), TODAY)).toBe(false);
  });

  it("returns false when no due date", () => {
    expect(isUpcoming(task({ due_date: null }), TODAY)).toBe(false);
  });

  it("returns false when completed", () => {
    expect(isUpcoming(task({ due_date: TOMORROW, completed: "2025-06-15T09:00:00Z" }), TODAY)).toBe(false);
  });
});

// ── formatDue ─────────────────────────────────────────────────────────────────

describe("formatDue", () => {
  it("returns null when no due date", () => {
    expect(formatDue(task({ due_date: null }), TODAY)).toBeNull();
  });

  it("returns overdue for past dates", () => {
    const result = formatDue(task({ due_date: YESTERDAY }), TODAY);
    expect(result).toEqual({ label: "Overdue", cls: "overdue" });
  });

  it("returns Today for today's date", () => {
    const result = formatDue(task({ due_date: TODAY }), TODAY);
    expect(result).toEqual({ label: "Today", cls: "today" });
  });

  it("returns Tomorrow for tomorrow's date", () => {
    const result = formatDue(task({ due_date: TOMORROW }), TODAY);
    expect(result).toEqual({ label: "Tomorrow", cls: "tomorrow" });
  });

  it("returns formatted date for upcoming dates", () => {
    const result = formatDue(task({ due_date: NEXT_WEEK }), TODAY);
    expect(result.label).toMatch(/Jun 22/);
    expect(result.cls).toBe("");
  });
});

// ── nextDueDate ───────────────────────────────────────────────────────────────

describe("nextDueDate", () => {
  it("returns null when dueDate or rule is missing", () => {
    expect(nextDueDate(null, { freq: "daily" })).toBeNull();
    expect(nextDueDate("2025-06-15", null)).toBeNull();
  });

  it("advances by 1 day for daily recurrence", () => {
    expect(nextDueDate("2025-06-15", { freq: "daily" })).toBe("2025-06-16");
  });

  it("advances by custom interval for daily", () => {
    expect(nextDueDate("2025-06-15", { freq: "daily", interval: 3 })).toBe("2025-06-18");
  });

  it("advances by 7 days for weekly (single day)", () => {
    expect(nextDueDate("2025-06-15", { freq: "weekly" })).toBe("2025-06-22");
  });

  it("advances by interval weeks for weekly (single day)", () => {
    expect(nextDueDate("2025-06-15", { freq: "weekly", interval: 2 })).toBe("2025-06-29");
  });

  it("finds next matching weekday for multi-day weekly recurrence", () => {
    // 2025-06-15 is Sunday (index 0); next occurrence is Tuesday (index 2)
    const result = nextDueDate("2025-06-15", { freq: "weekly", days: ["sun", "tue", "thu"] });
    expect(result).toBe("2025-06-17"); // Tuesday
  });

  it("wraps to next week when no later day this week", () => {
    // 2025-06-14 is Saturday (index 6); no day after sat in [mon, wed], wraps to Monday
    const result = nextDueDate("2025-06-14", { freq: "weekly", days: ["mon", "wed"] });
    expect(result).toBe("2025-06-16"); // next Monday
  });

  it("advances by 1 month for monthly recurrence", () => {
    expect(nextDueDate("2025-06-15", { freq: "monthly" })).toBe("2025-07-15");
  });

  it("advances by 1 year for yearly recurrence", () => {
    expect(nextDueDate("2025-06-15", { freq: "yearly" })).toBe("2026-06-15");
  });
});

// ── Completing a task (page and widget) ───────────────────────────────────────

describe("nextOccurrence", () => {
  const repeating = {
    id: "t1", list_id: "l1", title: "Water plants", notes: "Back porch", assignee_id: "m1",
    due_date: "2025-06-15", due_time: "08:00", priority: 2, labels: '["home"]',
    recurrence: '{"freq":"weekly"}', completed: 1,
  };

  it("carries the task forward to its next due date", () => {
    expect(nextOccurrence(repeating)).toEqual({
      list_id: "l1", title: "Water plants", notes: "Back porch", assignee_id: "m1",
      due_date: "2025-06-22", due_time: "08:00", priority: 2, labels: ["home"],
      recurrence: { freq: "weekly" }, parent_id: null,
    });
  });

  it("is null for a task that does not repeat or has no due date", () => {
    expect(nextOccurrence({ ...repeating, recurrence: null })).toBeNull();
    expect(nextOccurrence({ ...repeating, due_date: null })).toBeNull();
    expect(nextOccurrence(null)).toBeNull();
  });

  it("is null for a rule that cannot be read", () => {
    expect(nextOccurrence({ ...repeating, recurrence: "{not json" })).toBeNull();
  });
});

describe("taskInsert", () => {
  it("binds one value per placeholder, in column order", () => {
    const { sql, params } = taskInsert("t2", {
      list_id: "l1", title: "Water plants", notes: "Back porch", due_date: "2025-06-22",
      due_time: "08:00", priority: 2, labels: ["home"], recurrence: { freq: "weekly" }, parent_id: null,
    }, "m1", "m9", "2025-06-15T10:00:00.000Z");
    expect(sql).toMatch(/^INSERT INTO app_tasks__tasks \(/);
    expect(params.length).toBe((sql.match(/\?/g) ?? []).length);
    expect(params).toEqual([
      "t2", "l1", "Water plants", "Back porch", "m1", "2025-06-22", "08:00", 2,
      '["home"]', '{"freq":"weekly"}', null, "m9", "2025-06-15T10:00:00.000Z", "2025-06-15T10:00:00.000Z",
    ]);
  });

  it("stores the empty defaults for a bare task", () => {
    const { params } = taskInsert("t3", { title: "Call plumber" }, null, null, "ts");
    expect(params).toEqual(["t3", null, "Call plumber", "", null, null, null, 0, "[]", null, null, null, "ts", "ts"]);
  });
});

describe("event payloads", () => {
  const t = { id: "t1", title: "Secret", notes: "Private", assignee_id: "m1", list_id: "l1", due_date: "2025-06-15" };

  it("task.completed carries ids and dates, never the task's text", () => {
    const payload = taskCompletedPayload(t, "m2", "2025-06-15T10:00:00.000Z");
    expect(payload).toEqual({
      task_id: "t1", assignee_id: "m1", completed_by: "m2", list_id: "l1",
      due_date: "2025-06-15", completed_at: "2025-06-15T10:00:00.000Z",
    });
    expect(JSON.stringify(payload)).not.toMatch(/Secret|Private/);
  });

  it("task.created carries the saved assignee and omits what is unset", () => {
    expect(taskCreatedPayload("t2", { title: "Secret", due_date: "2025-06-22" }, "m1", "m2")).toEqual({
      task_id: "t2", assignee_id: "m1", list_id: undefined, due_date: "2025-06-22", created_by: "m2",
    });
    expect(JSON.stringify(taskCreatedPayload("t2", { title: "Secret" }, null, null))).toBe('{"task_id":"t2"}');
  });
});

// ── sortTasks ─────────────────────────────────────────────────────────────────

describe("sortTasks", () => {
  it("sorts tasks by due date ascending", () => {
    const tasks = [
      task({ id: "a", due_date: NEXT_WEEK }),
      task({ id: "b", due_date: YESTERDAY }),
      task({ id: "c", due_date: TODAY }),
    ];
    const sorted = sortTasks(tasks);
    expect(sorted.map(t => t.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts tasks with no due date last", () => {
    const tasks = [
      task({ id: "a", due_date: null }),
      task({ id: "b", due_date: TODAY }),
    ];
    expect(sortTasks(tasks).map(t => t.id)).toEqual(["b", "a"]);
  });

  it("sorts by priority descending when due dates are equal", () => {
    const tasks = [
      task({ id: "a", due_date: TODAY, priority: 1 }),
      task({ id: "b", due_date: TODAY, priority: 3 }),
      task({ id: "c", due_date: TODAY, priority: 2 }),
    ];
    expect(sortTasks(tasks).map(t => t.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const tasks = [task({ id: "a", due_date: TOMORROW }), task({ id: "b", due_date: TODAY })];
    const copy = [...tasks];
    sortTasks(tasks);
    expect(tasks).toEqual(copy);
  });
});

describe("searchableFields", () => {
  it("matches on notes and labels, not just the task title", () => {
    const fields = searchableFields({ title: "Call back", notes: "plumber, 07700 900123", labels: "house,urgent" });
    expect(fields).toContain("plumber, 07700 900123");
    expect(fields).toContain("house,urgent");
  });
});

describe("who supervises tasks", () => {
  const adult = { id: "a1", role: "adult" };
  const child = { id: "c1", role: "child" };
  const other = { id: "a2", role: "adult" };
  const members = [adult, child, other];
  const participant = { tenantKind: "shared_space", spaceKind: "general", isAdmin: false };
  const steward = { tenantKind: "shared_space", spaceKind: "general", isAdmin: true };
  const coparentSteward = { tenantKind: "shared_space", spaceKind: "coparenting", isAdmin: true };

  it("a household is the default, where any adult supervises", () => {
    expect(supervisesTasks(adult)).toBe(true);
    expect(supervisesTasks(child)).toBe(false);
    expect(supervisesTasks(null)).toBe(false);
    expect(supervisesTasks(child, { tenantKind: "household", isAdmin: true })).toBe(false);
  });

  it("only the steward supervises in a shared space", () => {
    expect(supervisesTasks(adult, participant)).toBe(false);
    expect(supervisesTasks(adult, steward)).toBe(true);
    expect(supervisesTasks(adult, coparentSteward)).toBe(true);
  });

  it("offers every member to a supervisor and only the member themself otherwise", () => {
    expect(assignableMembers(adult, members)).toEqual(members);
    expect(assignableMembers(adult, members, steward)).toEqual(members);
    expect(assignableMembers(adult, members, participant)).toEqual([adult]);
    expect(assignableMembers(child, members)).toEqual([child]);
    expect(assignableMembers(null, members, participant)).toEqual([]);
  });

  it("saves a supervisor's choice, including unassigned", () => {
    expect(savedAssigneeId("a2", adult)).toBe("a2");
    expect(savedAssigneeId("", adult)).toBe(null);
    expect(savedAssigneeId(null, adult, steward)).toBe(null);
    expect(savedAssigneeId("c1", adult, steward)).toBe("c1");
  });

  it("saves anyone else's task under their own id", () => {
    expect(savedAssigneeId("a2", adult, participant)).toBe("a1");
    expect(savedAssigneeId(null, adult, participant)).toBe("a1");
    expect(savedAssigneeId("a1", child)).toBe("c1");
    expect(savedAssigneeId("a2", null, participant)).toBe(null);
  });
});
