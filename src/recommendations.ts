import { matchDaySession, sessions } from "./program";
import type { ActivityLog, AppState, OptionalWeekDay, PlanOverride, RecommendationSessionId, SessionId, Variant, WeekDay, WeekPlan } from "./types";
import { todayKey } from "./storage";

export const dayLabels: Record<WeekDay, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export const effortLabels = {
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  very_hard: "Very hard",
} as const;

export const legLabels = {
  fresh: "Fresh",
  normal: "Normal",
  heavy: "Heavy",
  very_heavy: "Very heavy",
} as const;

export const activityLabels = {
  team_practice: "Team practice",
  match: "Match",
  pickup: "Pickup",
  conditioning: "Conditioning",
  manual_labor: "Manual labor",
} as const;

export type Recommendation = {
  session: typeof matchDaySession | (typeof sessions)[SessionId];
  variant: Variant;
  reason: string;
  caution: string;
};

export type PlannedItem = {
  id: SessionId | "practice" | "pickup" | "game";
  label: string;
  day: OptionalWeekDay;
  variant?: Variant;
  status: "complete" | "moved" | "skipped" | "replaced" | "missed" | "upcoming" | "today" | "none";
  completedDate?: string;
  override?: PlanOverride;
};

export function daysUntilDay(targetDay: OptionalWeekDay, date = new Date()) {
  if (targetDay === "none") return null;
  return (targetDay - date.getDay() + 7) % 7;
}

export function startOfTrainingWeek(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
  start.setHours(0, 0, 0, 0);
  return start;
}

export function trainingWeekKey(date = new Date()) {
  return todayKey(startOfTrainingWeek(date));
}

export function getWeekPlan(state: AppState, date = new Date()): WeekPlan {
  return state.weekPlans[trainingWeekKey(date)] ?? state.weekPlan;
}

export function isInCurrentTrainingWeek(isoDate: string, date = new Date()) {
  const logged = new Date(isoDate);
  const start = startOfTrainingWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return logged >= start && logged < end;
}

export function activityLoad(activity: ActivityLog) {
  const duration = Number(activity.durationMinutes) || 0;
  let load = Math.min(4, duration / 45);
  if (activity.activityType === "match") load += 4;
  if (activity.activityType === "team_practice" || activity.activityType === "pickup") load += 3;
  if (activity.activityType === "manual_labor") load += 2;
  if (activity.effort === "hard") load += 1.5;
  if (activity.effort === "very_hard") load += 3;
  if (activity.legs === "heavy") load += 1;
  if (activity.legs === "very_heavy") load += 2;
  return Math.min(10, Math.round(load));
}

export function recentLoad(state: AppState, date = new Date()) {
  const activityTotal = state.activities.reduce((sum, activity) => {
    const multiplier = loadDecayMultiplier(activity.date, date);
    if (multiplier === 0) return sum;
    return sum + activityLoad(activity) * multiplier;
  }, 0);
  const workoutTotal = state.workouts.reduce((sum, workout) => {
    const multiplier = loadDecayMultiplier(workout.date, date);
    if (multiplier === 0) return sum;
    return sum + workoutLoad(workout.sessionId, workout.variant, workout.rating) * multiplier;
  }, 0);
  return Math.min(12, Math.round(activityTotal + workoutTotal));
}

export function workoutLoad(sessionId: SessionId, variant: Variant, rating: ActivityLog["effort"]) {
  const variantMultiplier = variant === "primer" ? 0.35 : variant === "short" ? 0.65 : 1;
  const ratingBonus = rating === "hard" ? 1 : rating === "very_hard" ? 2 : rating === "easy" ? -1 : 0;
  return Math.max(1, Math.min(10, Math.round(sessions[sessionId].load * variantMultiplier + ratingBonus)));
}

function loadDecayMultiplier(isoDate: string, date: Date) {
  const elapsedHours = (date.getTime() - new Date(isoDate).getTime()) / (60 * 60 * 1000);
  if (elapsedHours < 0 || elapsedHours > 48) return 0;
  if (elapsedHours <= 12) return 1;
  if (elapsedHours <= 24) return 0.75;
  if (elapsedHours <= 36) return 0.5;
  return 0.25;
}

export function recommendSession(state: AppState, date = new Date()): Recommendation {
  const day = date.getDay();
  const weekPlan = getWeekPlan(state, date);
  const daysToGame = daysUntilDay(weekPlan.gameDay, date);
  const load = recentLoad(state, date);
  const completedToday = state.workouts.find((log) => todayKey(new Date(log.date)) === todayKey(date));
  const overrides = state.planOverrides[trainingWeekKey(date)] ?? {};
  const gameAdjusted = Boolean(overrides.game);
  const practiceAdjusted = Boolean(overrides.practice);
  const pickupAdjusted = Boolean(overrides.pickup);
  const effectiveDaysToGame = gameAdjusted ? null : daysToGame;
  const variant: Variant = load >= 10 || effectiveDaysToGame === 1 ? "primer" : load >= 7 ? "short" : "full";

  if (completedToday) {
    return { session: sessions["zone-2"], variant: "primer", reason: "You already logged a workout today. Keep any extra work easy.", caution: "Do not chase extra volume after a completed session." };
  }

  if (effectiveDaysToGame === 0) {
    return { session: matchDaySession, variant: "full", reason: "You have a match today. The priority is performance, not gym volume.", caution: "Log the match afterward with your Apple Watch summary and leg rating." };
  }

  if (effectiveDaysToGame === 1) {
    return { session: sessions.activation, variant: "primer", reason: `Your ${dayLabels[weekPlan.gameDay as WeekDay]} match is tomorrow, so the goal is freshness.`, caution: "Skip heavy lower-body lifting inside 24 hours of a match." };
  }

  if (day === weekPlan.practiceDay && !practiceAdjusted) {
    return { session: sessions["zone-2"], variant: "primer", reason: "Team practice is the priority today.", caution: "Log the Apple Watch summary after practice." };
  }

  if (load >= 10) {
    return { session: sessions["upper-a"], variant: "primer", reason: "Recent training load is high, so today should be a low-volume upper-body primer.", caution: "Skip conditioning and heavy lower-body work." };
  }

  const plannedToday = plannedWorkoutForDate(state, date);
  if (plannedToday) {
    return {
      session: sessions[plannedToday.id],
      variant: plannedToday.variant ?? variant,
      reason: `${plannedToday.label} is the planned session for this match week setup.`,
      caution: plannedToday.id.startsWith("lower") ? "Keep the primer version if your legs are heavy from practice, yard work, or soccer load." : "Keep reps clean and avoid grinding.",
    };
  }

  const weekWorkouts = state.workouts.filter((log) => isInCurrentTrainingWeek(log.date, date));
  const hasLowerA = weekWorkouts.some((log) => log.sessionId === "lower-a") || Boolean(overrides["lower-a"]);
  const hasUpperA = weekWorkouts.some((log) => log.sessionId === "upper-a") || Boolean(overrides["upper-a"]);
  const hasLowerB = weekWorkouts.some((log) => log.sessionId === "lower-b") || Boolean(overrides["lower-b"]);
  const hasUpperB = weekWorkouts.some((log) => log.sessionId === "upper-b") || Boolean(overrides["upper-b"]);
  const hasLowerWindow = effectiveDaysToGame === null || effectiveDaysToGame >= 3;

  if (!hasLowerA && hasLowerWindow) return { session: sessions["lower-a"], variant, reason: "Lower A is still open this week and you have enough space before the match.", caution: "Use short or primer if legs feel flat." };
  if (!hasUpperA) return { session: sessions["upper-a"], variant, reason: `Upper body fits well around ${dayLabels[weekPlan.practiceDay]} practice.`, caution: "Leave 1-2 reps in reserve on pressing." };
  if (!hasLowerB && hasLowerWindow) return { session: sessions["lower-b"], variant, reason: "Lower B is the next missing strength priority this week.", caution: "If practice or work crushed your legs, run the short version." };
  if (day === weekPlan.pickupDay && !pickupAdjusted && !hasUpperB) return { session: sessions["upper-b"], variant, reason: "Pull-up work pairs well with pickup if you keep it crisp.", caution: "Keep legs fresh if the game moves earlier." };
  if (!hasUpperB) return { session: sessions["upper-b"], variant, reason: "Pull-up and upper-body work is the remaining low-fatigue strength priority.", caution: "Keep legs fresh if the game moves earlier." };

  return { session: sessions["zone-2"], variant: "short", reason: "The main strength sessions are covered this week.", caution: "Keep this easy enough to recover from." };
}

export function buildWeeklyPlan(state: AppState, date = new Date()): PlannedItem[] {
  const weekPlan = getWeekPlan(state, date);
  const trainingDays = chooseTrainingDays(weekPlan, date);

  const items: PlannedItem[] = [
    { id: "lower-a", label: "Lower A", day: trainingDays["lower-a"], variant: "full", status: "upcoming" },
    { id: "upper-a", label: "Upper A", day: trainingDays["upper-a"], variant: "full", status: "upcoming" },
    { id: "practice", label: "Team practice", day: weekPlan.practiceDay, status: "upcoming" },
    { id: "lower-b", label: "Lower B", day: trainingDays["lower-b"], variant: lowerBVariant(weekPlan, trainingDays["lower-b"], date), status: "upcoming" },
    { id: "upper-b", label: "Upper B", day: trainingDays["upper-b"], variant: "full", status: "upcoming" },
    { id: "pickup", label: "Pickup", day: weekPlan.pickupDay, status: "none" },
    { id: "activation", label: "Match prep", day: dayBefore(weekPlan.gameDay), variant: "primer", status: "upcoming" },
    { id: "game", label: "Game", day: weekPlan.gameDay, status: "none" },
  ];

  const overrides = state.planOverrides[trainingWeekKey(date)] ?? {};
  return items.map((item) => {
    const completion = plannedCompletion(item, state, date);
    const override = overrides[item.id];
    return { ...item, status: plannedStatus(item, completion, date, override), completedDate: completion?.dateKey, override };
  }).sort(comparePlannedItems);
}

function chooseTrainingDays(weekPlan: WeekPlan, date: Date): Record<SessionId, OptionalWeekDay> {
  if (weekPlan.practiceDay === 2 && weekPlan.gameDay === 0) {
    return {
      "lower-a": 3,
      "upper-a": 1,
      "lower-b": 5,
      "upper-b": 4,
      activation: 6,
      "zone-2": "none",
    };
  }

  if (weekPlan.practiceDay === 2 && weekPlan.gameDay === 6) {
    return {
      "lower-a": 1,
      "upper-a": 3,
      "lower-b": 4,
      "upper-b": 0,
      activation: 5,
      "zone-2": "none",
    };
  }

  const assigned = new Set<WeekDay>();
  const lowerA = chooseWorkoutDay(weekPlan, assigned, date, "lower");
  const lowerB = chooseWorkoutDay(weekPlan, assigned, date, "lower", lowerA);
  const upperA = chooseWorkoutDay(weekPlan, assigned, date, "upper");
  const upperB = weekPlan.pickupDay !== "none" && weekPlan.pickupDay !== weekPlan.gameDay
    ? weekPlan.pickupDay
    : chooseWorkoutDay(weekPlan, assigned, date, "upper", upperA);

  if (upperB !== "none") assigned.add(upperB);

  return {
    "lower-a": lowerA,
    "upper-a": upperA,
    "lower-b": lowerB,
    "upper-b": upperB,
    activation: dayBefore(weekPlan.gameDay),
    "zone-2": "none",
  };
}

function comparePlannedItems(a: PlannedItem, b: PlannedItem) {
  const dayDelta = plannedDaySortValue(a.day) - plannedDaySortValue(b.day);
  if (dayDelta) return dayDelta;
  return plannedItemPriority(a.id) - plannedItemPriority(b.id);
}

function plannedDaySortValue(day: OptionalWeekDay) {
  if (day === "none") return 99;
  return (day + 6) % 7;
}

function plannedItemPriority(id: PlannedItem["id"]) {
  if (id === "practice") return 0;
  if (id === "lower-a") return 1;
  if (id === "upper-a") return 2;
  if (id === "lower-b") return 3;
  if (id === "upper-b") return 4;
  if (id === "pickup") return 5;
  if (id === "activation") return 6;
  if (id === "game") return 7;
  return 9;
}

function plannedWorkoutForDate(state: AppState, date: Date) {
  const dateKey = todayKey(date);
  return buildWeeklyPlan(state, date).find((item): item is PlannedItem & { id: SessionId } => {
    if (!(item.id in sessions) || item.day === "none" || item.override) return false;
    return todayKey(dateForWeekday(item.day, date)) === dateKey;
  });
}

function lowerBVariant(weekPlan: WeekPlan, lowerBDay: OptionalWeekDay, date: Date): Variant {
  if (lowerBDay === "none") return "primer";
  const daysToGame = daysUntilDay(weekPlan.gameDay, dateForWeekday(lowerBDay, date));
  if (daysToGame !== null && daysToGame <= 2) return "primer";
  if (daysToGame === 3) return "short";
  return "full";
}

function dayBefore(day: OptionalWeekDay): OptionalWeekDay {
  if (day === "none") return "none";
  return ((day + 6) % 7) as WeekDay;
}

function chooseWorkoutDay(weekPlan: WeekPlan, assigned: Set<WeekDay>, date: Date, type: "lower" | "upper", afterDay?: OptionalWeekDay): OptionalWeekDay {
  const order: WeekDay[] = [1, 2, 3, 4, 5, 6, 0];
  const afterIndex = afterDay === undefined || afterDay === "none" ? -1 : order.indexOf(afterDay);
  const day = order.find((candidate, index) => {
    if (index <= afterIndex || assigned.has(candidate) || candidate === weekPlan.practiceDay || candidate === weekPlan.gameDay || candidate === weekPlan.pickupDay) return false;
    if (type === "upper") return daysUntilDay(weekPlan.gameDay, dateForWeekday(candidate, date)) !== 1;
    const daysToGame = daysUntilDay(weekPlan.gameDay, dateForWeekday(candidate, date));
    return daysToGame === null || daysToGame >= 3;
  });
  if (day !== undefined) assigned.add(day);
  return day ?? "none";
}

function dateForWeekday(day: WeekDay, base = new Date()) {
  const date = startOfTrainingWeek(base);
  date.setDate(date.getDate() + ((day + 6) % 7));
  return date;
}

function plannedCompletion(item: PlannedItem, state: AppState, date: Date) {
  if (item.day === "none") return null;
  const plannedDate = dateForWeekday(item.day, date);
  const plannedDateKey = todayKey(plannedDate);
  const completions = item.id === "practice" || item.id === "pickup" || item.id === "game"
    ? state.activities.filter((activity) => activityMatches(item.id, activity) && isInCurrentTrainingWeek(activity.date, date))
    : state.workouts.filter((workout) => workout.sessionId === item.id && isInCurrentTrainingWeek(workout.date, date));
  const completedDateKey = completions.find((completion) => todayKey(new Date(completion.date)) === plannedDateKey)
    ?? [...completions].sort((a, b) => Math.abs(new Date(a.date).getTime() - plannedDate.getTime()) - Math.abs(new Date(b.date).getTime() - plannedDate.getTime()))[0];

  if (!completedDateKey) return null;
  const dateKey = todayKey(new Date(completedDateKey.date));
  return { dateKey, onPlannedDay: dateKey === plannedDateKey };
}

function plannedStatus(item: PlannedItem, completion: ReturnType<typeof plannedCompletion>, date: Date, override?: PlanOverride): PlannedItem["status"] {
  if (item.day === "none") return "none";
  const today = todayKey();
  const plannedDate = dateForWeekday(item.day, date);
  const plannedDateKey = todayKey(plannedDate);
  if (completion) return completion.onPlannedDay ? "complete" : "moved";
  if (override) return override.status;
  if (plannedDateKey === today) return "today";
  return plannedDateKey < today ? "missed" : "upcoming";
}

function activityMatches(id: PlannedItem["id"], activity: ActivityLog) {
  return (id === "practice" && activity.activityType === "team_practice") || (id === "pickup" && activity.activityType === "pickup") || (id === "game" && activity.activityType === "match");
}

export function isTrainableSession(sessionId: RecommendationSessionId): sessionId is SessionId {
  return sessionId !== "match-day";
}

export function parseOptionalDay(value: string): OptionalWeekDay {
  return value === "none" ? "none" : (Number(value) as WeekDay);
}
