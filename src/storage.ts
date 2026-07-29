import type { ActiveWorkoutDraft, ActivityLog, AppSettings, AppState, Effort, Legs, OptionalWeekDay, PlanOverride, SessionId, SetLog, Variant, WeekDay, WeekPlan, WeekPlanRevision, WorkoutLog } from "./types";
import { getMovements, getSessionVariant, sessions } from "./program";

export const defaultWeekPlan: WeekPlan = {
  practiceDay: 2,
  gameDay: 0,
  pickupDay: "none",
};

export const defaultState: AppState = {
  workouts: [],
  activities: [],
  weekPlan: defaultWeekPlan,
  weekPlans: {},
  weekPlanRevisions: {},
  planOverrides: {},
  settings: {
    timerAlerts: true,
  },
};

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem("pitchform-state-v1");
    const parsed = saved ? JSON.parse(saved) : {};
    return normalizeState(parsed) ?? defaultState;
  } catch {
    return defaultState;
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem("pitchform-state-v1", JSON.stringify(state));
    return true;
  } catch {
    // Local storage can fail in private browsing or if the device is full.
    return false;
  }
}

export function normalizeState(value: unknown): AppState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppState>;
  const importedWeekPlan = (candidate.weekPlan ?? {}) as Partial<WeekPlan>;
  const practiceDay = isOptionalWeekDay(importedWeekPlan.practiceDay) ? importedWeekPlan.practiceDay : defaultWeekPlan.practiceDay;
  const gameDay = isOptionalWeekDay(importedWeekPlan.gameDay) ? importedWeekPlan.gameDay : defaultWeekPlan.gameDay;
  const pickupDay = isOptionalWeekDay(importedWeekPlan.pickupDay) ? importedWeekPlan.pickupDay : defaultWeekPlan.pickupDay;
  const weekPlans = normalizeWeekPlans(candidate.weekPlans);
  return {
    workouts: Array.isArray(candidate.workouts) ? candidate.workouts.filter(isWorkoutLog) : [],
    activities: Array.isArray(candidate.activities) ? candidate.activities.filter(isActivityLog) : [],
    weekPlan: { practiceDay, gameDay, pickupDay },
    weekPlans,
    weekPlanRevisions: normalizeWeekPlanRevisions(candidate.weekPlanRevisions, weekPlans),
    planOverrides: normalizePlanOverrides(candidate.planOverrides),
    settings: normalizeSettings(candidate.settings),
    activeDraft: normalizeDraft(candidate.activeDraft),
  };
}

function normalizeDraft(value: unknown): ActiveWorkoutDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const draft = value as Partial<ActiveWorkoutDraft>;
  if (!isSessionId(draft.sessionId) || !isVariant(draft.variant) || typeof draft.sets !== "object" || !draft.sets || !hasValidSetShape(draft.sets)) return undefined;
  const session = getSessionVariant(draft.sessionId, draft.variant);
  return {
    sessionId: draft.sessionId,
    variant: draft.variant,
    activeExercise: typeof draft.activeExercise === "number" ? Math.min(Math.max(0, draft.activeExercise), session.exercises.length - 1) : 0,
    sets: normalizeDraftSets(draft.sets, draft.sessionId, draft.variant),
    rating: isEffort(draft.rating) ? draft.rating : "moderate",
    notes: typeof draft.notes === "string" ? draft.notes : "",
    touched: Boolean(draft.touched),
    updatedAt: isIsoDateString(draft.updatedAt) ? draft.updatedAt : new Date().toISOString(),
    editingWorkoutId: typeof draft.editingWorkoutId === "string" ? draft.editingWorkoutId : undefined,
    originalDate: isIsoDateString(draft.originalDate) ? draft.originalDate : undefined,
    restEndsAt: isIsoDateString(draft.restEndsAt) ? draft.restEndsAt : undefined,
    restLabel: typeof draft.restLabel === "string" ? draft.restLabel : undefined,
  };
}

export function exportState(state: AppState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pitchform-backup-${todayKey()}.json`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeWeekPlans(value: unknown): Record<string, WeekPlan> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, plan]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && isWeekPlan(plan))
      .map(([key, plan]) => [key, plan as WeekPlan])
  );
}

function normalizeWeekPlanRevisions(value: unknown, weekPlans: Record<string, WeekPlan>): Record<string, WeekPlanRevision[]> {
  const normalized = value && typeof value === "object"
    ? Object.fromEntries(
      Object.entries(value)
        .filter(([key, revisions]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(revisions))
        .map(([key, revisions]) => [
          key,
          (revisions as unknown[])
            .filter(isWeekPlanRevision)
            .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
        ])
        .filter(([, revisions]) => revisions.length)
    ) as Record<string, WeekPlanRevision[]>
    : {};

  Object.entries(weekPlans).forEach(([weekKey, plan]) => {
    if (!normalized[weekKey]) normalized[weekKey] = [{ plan, updatedAt: "1970-01-01T00:00:00.000Z" }];
  });

  return normalized;
}

function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return defaultState.settings;
  const settings = value as Partial<AppSettings>;
  return {
    timerAlerts: typeof settings.timerAlerts === "boolean" ? settings.timerAlerts : defaultState.settings.timerAlerts,
  };
}

function normalizePlanOverrides(value: unknown): Record<string, Record<string, PlanOverride>> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([weekKey, overrides]) => /^\d{4}-\d{2}-\d{2}$/.test(weekKey) && overrides && typeof overrides === "object")
      .map(([weekKey, overrides]) => [
        weekKey,
        Object.fromEntries(
          Object.entries(overrides as Record<string, unknown>).filter(([itemId, override]) => isPlanOverrideKey(itemId) && isPlanOverride(override))
        ) as Record<string, PlanOverride>,
      ])
      .filter(([, overrides]) => Object.keys(overrides).length)
  );
}

function normalizeDraftSets(value: Record<string, SetLog[]>, sessionId: SessionId, variant: Variant): Record<string, SetLog[]> {
  const session = getSessionVariant(sessionId, variant);
  return Object.fromEntries(
    session.exercises.map((exercise) => {
      const movements = getMovements(exercise);
      const existingSets = Array.isArray(value[exercise.id]) ? value[exercise.id] : [];
      const sets = Array.from({ length: exercise.sets }, (_, setIndex) => {
        const existing = existingSets[setIndex];
        return {
          done: Boolean(existing?.done),
          movements: Object.fromEntries(
            movements.map((movement) => {
              const existingMovement = existing?.movements?.[movement.id];
              return [
                movement.id,
                {
                  reps: typeof existingMovement?.reps === "string" ? existingMovement.reps : movement.reps,
                  weight: typeof existingMovement?.weight === "string" ? existingMovement.weight : movement.defaultWeight ? String(movement.defaultWeight) : "",
                },
              ];
            })
          ),
        };
      });
      return [exercise.id, sets];
    })
  );
}

function isWeekDay(value: unknown): value is WeekDay {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 6;
}

function isOptionalWeekDay(value: unknown): value is OptionalWeekDay {
  return value === "none" || isWeekDay(value);
}

function isWeekPlan(value: unknown): value is WeekPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<WeekPlan>;
  return isOptionalWeekDay(plan.practiceDay) && isOptionalWeekDay(plan.gameDay) && isOptionalWeekDay(plan.pickupDay);
}

function isWeekPlanRevision(value: unknown): value is WeekPlanRevision {
  if (!value || typeof value !== "object") return false;
  const revision = value as Partial<WeekPlanRevision>;
  return isWeekPlan(revision.plan) && isIsoDateString(revision.updatedAt);
}

function isSessionId(value: unknown): value is SessionId {
  return typeof value === "string" && value in sessions;
}

function isVariant(value: unknown): value is Variant {
  return value === "full" || value === "short" || value === "primer";
}

function hasValidSetShape(value: unknown) {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some(Array.isArray) && Object.values(value).every((sets) =>
    Array.isArray(sets) &&
    sets.every((set) => set && typeof set === "object" && "movements" in set && typeof set.movements === "object")
  );
}

function isEffort(value: unknown): value is Effort {
  return value === "easy" || value === "moderate" || value === "hard" || value === "very_hard";
}

function isLegs(value: unknown): value is Legs {
  return value === "fresh" || value === "normal" || value === "heavy" || value === "very_heavy";
}

function isWorkoutLog(value: unknown): value is WorkoutLog {
  if (!value || typeof value !== "object") return false;
  const log = value as Partial<WorkoutLog>;
  return typeof log.id === "string" && isSessionId(log.sessionId) && typeof log.sessionTitle === "string" && isVariant(log.variant) && isIsoDateString(log.date) && isEffort(log.rating) && typeof log.notes === "string" && typeof log.sets === "object" && Boolean(log.sets) && hasValidSetShape(log.sets);
}

function isActivityLog(value: unknown): value is ActivityLog {
  if (!value || typeof value !== "object") return false;
  const log = value as Partial<ActivityLog>;
  return typeof log.id === "string" && isIsoDateString(log.date) && isActivityType(log.activityType) && typeof log.durationMinutes === "string" && isEffort(log.effort) && isLegs(log.legs) && typeof log.averageHeartRate === "string" && typeof log.maximumHeartRate === "string" && typeof log.activeCalories === "string" && typeof log.distanceMiles === "string" && typeof log.notes === "string";
}

function isActivityType(value: unknown): value is ActivityLog["activityType"] {
  return value === "team_practice" || value === "match" || value === "pickup" || value === "conditioning" || value === "manual_labor";
}

function isPlanOverride(value: unknown): value is PlanOverride {
  if (!value || typeof value !== "object") return false;
  const override = value as Partial<PlanOverride>;
  return (override.status === "skipped" || override.status === "replaced") && typeof override.note === "string" && isIsoDateString(override.updatedAt);
}

function isPlanOverrideKey(value: string) {
  return value === "lower-a" || value === "upper-a" || value === "lower-b" || value === "upper-b" || value === "activation" || value === "practice" || value === "pickup" || value === "game";
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}
