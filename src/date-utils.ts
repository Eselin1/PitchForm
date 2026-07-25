import { trainingWeekKey } from "./recommendations";
import { todayKey } from "./storage";
import type { WeekDay } from "./types";

export function getVisibleCalendarDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function formatMonthTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function formatDisplayDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function shortDateLabel(dateKey: string) {
  const date = dateFromKey(dateKey);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function dateKeyForWeekDay(weekDate: Date, day: WeekDay) {
  const start = dateFromKey(trainingWeekKey(weekDate));
  start.setDate(start.getDate() + ((day + 6) % 7));
  return todayKey(start);
}

export function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateForRecommendation(dateKey: string) {
  if (dateKey === todayKey()) return new Date();
  const date = dateFromKey(dateKey);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function timeFromIso(isoDate?: string) {
  const parsedDate = isoDate ? new Date(isoDate) : undefined;
  const date = parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function isoForDateKey(dateKey: string, time = timeFromIso()) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateFromKey(dateKey) : new Date();
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(Number.isFinite(hours) ? hours : 12, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date.toISOString();
}

export function formatWeekRange(dateKey: string) {
  const start = dateFromKey(trainingWeekKey(dateFromKey(dateKey)));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
}
