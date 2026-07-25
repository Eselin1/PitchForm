export type SessionId = "lower-a" | "upper-a" | "lower-b" | "upper-b" | "activation" | "zone-2";
export type RecommendationSessionId = SessionId | "match-day";
export type ActivityType = "team_practice" | "match" | "pickup" | "conditioning" | "manual_labor";
export type Effort = "easy" | "moderate" | "hard" | "very_hard";
export type Legs = "fresh" | "normal" | "heavy" | "very_heavy";
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type OptionalWeekDay = WeekDay | "none";
export type Variant = "full" | "short" | "primer";
export type Tab = "today" | "calendar" | "train" | "activity" | "history";
export type PlanOverrideStatus = "skipped" | "replaced";
export type Movement = {
  id: string;
  name: string;
  reps: string;
  defaultWeight?: number;
  unit?: "lb" | "bodyweight" | "time";
};

export type Exercise = {
  id: string;
  name: string;
  target: string;
  defaultWeight?: number;
  unit?: "lb" | "bodyweight" | "time";
  restSeconds?: number;
  sets: number;
  movements?: Movement[];
};

export type TrainingSession = {
  id: SessionId;
  title: string;
  category: "Strength" | "Recovery" | "Match Prep";
  duration: string;
  load: number;
  summary: string;
  exercises: Exercise[];
};

export type MovementLog = {
  reps: string;
  weight: string;
};

export type SetLog = {
  done: boolean;
  movements: Record<string, MovementLog>;
};

export type LoggedMovement = {
  id: string;
  name: string;
  unit?: "lb" | "bodyweight" | "time";
};

export type LoggedExercise = {
  id: string;
  name: string;
  movements: LoggedMovement[];
};

export type WorkoutLog = {
  id: string;
  sessionId: SessionId;
  sessionTitle: string;
  variant: Variant;
  date: string;
  rating: Effort;
  notes: string;
  sets: Record<string, SetLog[]>;
  exercises?: LoggedExercise[];
};

export type ActivityLog = {
  id: string;
  date: string;
  activityType: ActivityType;
  durationMinutes: string;
  effort: Effort;
  legs: Legs;
  averageHeartRate: string;
  maximumHeartRate: string;
  activeCalories: string;
  distanceMiles: string;
  notes: string;
};

export type WeekPlan = {
  practiceDay: WeekDay;
  gameDay: OptionalWeekDay;
  pickupDay: OptionalWeekDay;
};

export type PlanOverride = {
  status: PlanOverrideStatus;
  note: string;
  updatedAt: string;
};

export type WeekPlanRevision = {
  plan: WeekPlan;
  updatedAt: string;
};

export type AppSettings = {
  timerAlerts: boolean;
};

export type ActiveWorkoutDraft = {
  sessionId: SessionId;
  variant: Variant;
  activeExercise: number;
  sets: Record<string, SetLog[]>;
  rating: Effort;
  notes: string;
  touched: boolean;
  updatedAt: string;
  editingWorkoutId?: string;
  originalDate?: string;
  restEndsAt?: string;
  restLabel?: string;
};

export type AppState = {
  workouts: WorkoutLog[];
  activities: ActivityLog[];
  weekPlan: WeekPlan;
  weekPlans: Record<string, WeekPlan>;
  weekPlanRevisions: Record<string, WeekPlanRevision[]>;
  planOverrides: Record<string, Record<string, PlanOverride>>;
  settings: AppSettings;
  activeDraft?: ActiveWorkoutDraft;
};

export type MatchDaySession = {
  id: "match-day";
  title: string;
  category: "Match Prep";
  duration: string;
  load: number;
  summary: string;
};
