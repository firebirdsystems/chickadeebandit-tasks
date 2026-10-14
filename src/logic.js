/**
 * Pure business logic for the Tasks app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

export const PRIORITY_COLORS  = { 0: "transparent", 1: "#2563eb", 2: "#d97706", 3: "#dc2626" };
export const PRIORITY_LABELS  = { 0: "None", 1: "Low", 2: "Med", 3: "High" };
export const PRIORITY_CLASSES = { 0: "sel-none", 1: "sel-low", 2: "sel-med", 3: "sel-high" };

export const DAYS       = ["sun","mon","tue","wed","thu","fri","sat"];
export const DAY_LABELS = ["S","M","T","W","T","F","S"];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLabels(s) {
  try { return JSON.parse(s || "[]"); } catch { return []; }
}

export function isOverdue(t, today = todayStr()) {
  if (t.completed || !t.due_date) return false;
  return t.due_date < today;
}

export function isToday(t, today = todayStr()) {
  return t.due_date === today;
}

export function isTomorrow(t, today = todayStr()) {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return t.due_date === d.toISOString().split("T")[0];
}

export function isUpcoming(t, today = todayStr()) {
  if (!t.due_date || t.completed) return false;
  return t.due_date > today;
}

export function formatDue(t, today = todayStr()) {
  if (!t.due_date) return null;
  if (isOverdue(t, today))  return { label: "Overdue",   cls: "overdue" };
  if (isToday(t, today))    return { label: "Today",     cls: "today" };
  if (isTomorrow(t, today)) return { label: "Tomorrow",  cls: "tomorrow" };
  const d = new Date(t.due_date + "T00:00:00");
  return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), cls: "" };
}

export function nextDueDate(dueDate, rule) {
  if (!dueDate || !rule) return null;
  const d = new Date(dueDate + "T00:00:00");
  const { freq, interval = 1 } = rule;
  if (freq === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (freq === "weekly") {
    if (rule.days?.length > 1) {
      const sel = rule.days.map(x => DAYS.indexOf(x)).sort((a, b) => a - b);
      const cur = d.getDay();
      const next = sel.find(x => x > cur);
      if (next != null) d.setDate(d.getDate() + (next - cur));
      else d.setDate(d.getDate() + (7 * interval - cur + sel[0]));
    } else {
      d.setDate(d.getDate() + 7 * interval);
    }
  } else if (freq === "monthly") {
    d.setMonth(d.getMonth() + interval);
  } else if (freq === "yearly") {
    d.setFullYear(d.getFullYear() + interval);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The task a repeating task leaves behind when it is completed: the same task
 * on its next due date. Null when the task does not repeat, has no due date to
 * count from, or carries a rule that cannot be read.
 */
export function nextOccurrence(task) {
  if (!task?.recurrence || !task.due_date) return null;
  let rule;
  try { rule = typeof task.recurrence === "string" ? JSON.parse(task.recurrence) : task.recurrence; } catch { return null; }
  const nextDate = nextDueDate(task.due_date, rule);
  if (!nextDate) return null;
  return {
    list_id: task.list_id,
    title: task.title,
    notes: task.notes,
    assignee_id: task.assignee_id,
    due_date: nextDate,
    due_time: task.due_time,
    priority: task.priority,
    labels: parseLabels(task.labels),
    recurrence: rule,
    parent_id: null,
  };
}

/** The statement that stores a new task, shared by the page and the widget. */
export function taskInsert(id, fields, assigneeId, memberId, ts) {
  return {
    sql: `INSERT INTO app_tasks__tasks (id,list_id,title,notes,assignee_id,due_date,due_time,priority,labels,recurrence,completed,parent_id,created_by,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`,
    params: [id, fields.list_id||null, fields.title, fields.notes||"",
     assigneeId, fields.due_date||null, fields.due_time||null,
     fields.priority||0, JSON.stringify(fields.labels||[]),
     fields.recurrence ? JSON.stringify(fields.recurrence) : null,
     fields.parent_id||null, memberId||null, ts, ts],
  };
}

/**
 * Event payloads carry ids and dates only, never the task title or notes.
 * Tasks are `owner_only` on assignee_id, so their text is visible to one
 * member, while the event bus is household-wide.
 */
export function taskCreatedPayload(id, fields, assigneeId, memberId) {
  return {
    task_id: id,
    assignee_id: assigneeId || undefined,
    list_id: fields.list_id || undefined,
    due_date: fields.due_date || undefined,
    created_by: memberId || undefined,
  };
}

export function taskCompletedPayload(task, memberId, completedAt) {
  return {
    task_id: task.id,
    assignee_id: task.assignee_id || undefined,
    completed_by: memberId || undefined,
    list_id: task.list_id || undefined,
    due_date: task.due_date || undefined,
    completed_at: completedAt || undefined,
  };
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aDate = a.due_date || "9999";
    const bDate = b.due_date || "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (b.priority || 0) - (a.priority || 0);
  });
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * Notes and labels count as well as the title — a task is found again
 * by the detail written into it ("the number for the plumber") or by a
 * label, not only by the one line it was named.
 */
export function searchableFields(item) {
  return [item.title, item.notes, item.labels];
}

function isAdultMember(member) {
  return !!member && (member.role === "adult" || member.role === "admin");
}

/**
 * Whether a member sees and assigns other members' tasks. Mirrors the hub's
 * rule for the tasks table (owner_only on assignee_id): any adult in a
 * household, and only the steward in a shared space. Anyone else reads and
 * writes the tasks assigned to them alone.
 */
export function supervisesTasks(member, { tenantKind = "household", isAdmin = false } = {}) {
  return tenantKind === "household" ? isAdultMember(member) : isAdmin === true;
}

/** The members a task may be assigned to: everyone for a supervisor, the
 *  member themself for anyone else. */
export function assignableMembers(member, members, tenant) {
  return supervisesTasks(member, tenant) ? members : members.filter(m => m.id === member?.id);
}

/**
 * The assignee a new task is saved under. The hub stamps a non-supervisor's
 * insert with their own id whatever the statement names, so the page and the
 * `task.created` event use this value rather than the one picked in the form.
 */
export function savedAssigneeId(chosenId, member, tenant) {
  if (supervisesTasks(member, tenant)) return chosenId || null;
  return member?.id ?? null;
}

/** Said by the app and the widget when a completion saved but the repeating
 *  task's next occurrence did not. */
export const NEXT_OCCURRENCE_FAILED = "Task completed, but its next occurrence couldn’t be scheduled.";

/**
 * Whether who sees a list is this member's choice. "private" means the OWNER
 * only, so anyone else picking it would hide the list from themselves and
 * everyone else. Mirrors the manifest (lists.column_write_acls.visibility,
 * writable_by ["owner"]), under which the hub drops a non-owner's whole UPDATE
 * that names the column. A new list is its creator's. With no member, every
 * list is "yours" only in demo mode (`demo`: no hub to refuse the write);
 * against a hub a member-less caller owns nothing, and every write is refused.
 */
export function ownsList(list, member, { demo = false } = {}) {
  if (!list?.id) return true;
  if (!member?.id) return demo;
  return list.member_id === member.id;
}

/** The columns an edit to a list writes: visibility only from its owner, or
 *  the hub's owner guard would drop the rename with it. */
export function listUpdateFields(list, member, { name, color, visibility }, opts) {
  return ownsList(list, member, opts) ? { name, color, visibility } : { name, color };
}

/**
 * Whether the page offers Delete on a list. Mirrors the manifest
 * (lists.delete_owner_only): a list is its owner's to delete, or a
 * supervisor's. A list whose owner is not among the members (none recorded, or
 * they have left) is a supervisor's alone.
 */
export function canDeleteList(list, member, supervises, opts) {
  return ownsList(list, member, opts) || supervises === true;
}

/**
 * Whether a member may delete other members' lists: a household adult, or the
 * steward of a general or roster space. The hub gives a co-parenting space's
 * steward no such exemption.
 */
export function supervisesListDeletes(member, tenant = {}) {
  return supervisesTasks(member, tenant) && tenant.spaceKind !== "coparenting";
}
