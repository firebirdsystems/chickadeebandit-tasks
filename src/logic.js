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

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const aDate = a.due_date || "9999";
    const bDate = b.due_date || "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return (b.priority || 0) - (a.priority || 0);
  });
}
