import { buildWeeklyPlan } from "./recommendations";
import type { ActivityLog, AppState, SessionId, WorkoutLog } from "./types";
import { dateFromKey, dateKeyForWeekDay } from "./date-utils";

export type PlannedListItem = ReturnType<typeof buildWeeklyPlan>[number];

export function stateThroughDate(state: AppState, dateKey: string): AppState {
  const end = dateFromKey(dateKey);
  end.setHours(23, 59, 59, 999);
  const weekPlans = weekPlansThroughDate(state, end);
  return {
    ...state,
    workouts: state.workouts.filter((item) => new Date(item.date) <= end),
    activities: state.activities.filter((item) => new Date(item.date) <= end),
    weekPlans,
    planOverrides: planOverridesThroughDate(state, end),
    activeDraft: undefined,
  };
}

export function plannedItemsForDate(state: AppState, dateKey: string) {
  const date = dateFromKey(dateKey);
  return buildWeeklyPlan(state, date).filter((item) => item.day !== "none" && dateKeyForWeekDay(date, item.day) === dateKey);
}

export function calendarLabelsForDate(state: AppState, dateKey: string) {
  const loggedItems = loggedItemsForDate(state, dateKey);
  if (loggedItems.length) return loggedItems.map((item) => item.shortLabel);
  return plannedItemsForDate(stateThroughDate(state, dateKey), dateKey).map((item) => shortPlanLabel(item));
}

export function shortPlanLabel(item: PlannedListItem) {
  if (item.id === "lower-a") return "LA";
  if (item.id === "lower-b") return "LB";
  if (item.id === "upper-a") return "UA";
  if (item.id === "upper-b") return "UB";
  if (item.id === "activation") return "MP";
  if (item.id === "zone-2") return "Z2";
  if (item.id === "practice") return "P";
  if (item.id === "pickup") return "PU";
  if (item.id === "game") return "G";
  return item.label.slice(0, 2).toUpperCase();
}

function weekPlansThroughDate(state: AppState, end: Date) {
  const weekPlans = { ...state.weekPlans };
  Object.entries(state.weekPlanRevisions).forEach(([weekKey, revisions]) => {
    const selectedRevision = [...revisions]
      .filter((revision) => new Date(revision.updatedAt) <= end)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (selectedRevision) weekPlans[weekKey] = selectedRevision.plan;
    else delete weekPlans[weekKey];
  });
  return weekPlans;
}

function planOverridesThroughDate(state: AppState, end: Date) {
  return Object.fromEntries(
    Object.entries(state.planOverrides)
      .map(([weekKey, overrides]) => [
        weekKey,
        Object.fromEntries(Object.entries(overrides).filter(([, override]) => new Date(override.updatedAt) <= end)),
      ])
      .filter(([, overrides]) => Object.keys(overrides).length)
  );
}

function loggedItemsForDate(state: AppState, dateKey: string) {
  return [...state.workouts.map(workoutCalendarItem), ...state.activities.map(activityCalendarItem)]
    .filter((item) => item.dateKey === dateKey)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function workoutCalendarItem(workout: WorkoutLog) {
  return {
    dateKey: dateKeyFromIso(workout.date),
    isoDate: workout.date,
    shortLabel: sessionShortLabel(workout.sessionId),
  };
}

function activityCalendarItem(activity: ActivityLog) {
  return {
    dateKey: dateKeyFromIso(activity.date),
    isoDate: activity.date,
    shortLabel: activityShortLabel(activity.activityType),
  };
}

function sessionShortLabel(sessionId: SessionId) {
  if (sessionId === "lower-a") return "LA";
  if (sessionId === "lower-b") return "LB";
  if (sessionId === "upper-a") return "UA";
  if (sessionId === "upper-b") return "UB";
  if (sessionId === "activation") return "MP";
  return "Z2";
}

function activityShortLabel(activityType: ActivityLog["activityType"]) {
  if (activityType === "team_practice") return "P";
  if (activityType === "pickup") return "PU";
  if (activityType === "match") return "G";
  if (activityType === "manual_labor") return "ML";
  return "C";
}

function dateKeyFromIso(isoDate: string) {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
