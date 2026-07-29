import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  HeartPulse,
  History,
  Home,
  Plus,
  RefreshCw,
  Save,
  Settings,
  TimerReset,
  Trash2,
  Pencil,
  Play,
} from "lucide-react";
import { getMovements, getSessionVariant, sessions } from "./program";
import {
  activityLabels,
  buildWeeklyPlan,
  dayLabels,
  effortLabels,
  getWeekPlan,
  isTrainableSession,
  legLabels,
  parseOptionalDay,
  recentLoad,
  recommendSession,
  trainingWeekKey,
  workoutLoad,
} from "./recommendations";
import { defaultState, defaultWeekPlan, exportState, loadState, normalizeState, saveState, todayKey } from "./storage";
import {
  dateForRecommendation,
  dateFromKey,
  dateKeyForWeekDay,
  formatDisplayDate,
  formatMonthTitle,
  formatWeekRange,
  getVisibleCalendarDays,
  isoForDateKey,
  shortDateLabel,
  timeFromIso,
} from "./date-utils";
import { calendarLabelsForDate, plannedItemsForDate, stateThroughDate, type PlannedListItem } from "./planner-view";
import { RestTimer } from "./RestTimer";
import { notifyRestComplete } from "./timer-alerts";
import type {
  ActivityLog,
  ActiveWorkoutDraft,
  AppState,
  Effort,
  Exercise,
  LoggedExercise,
  MovementLog,
  PlanOverrideStatus,
  SessionId,
  SetLog,
  Tab,
  Variant,
  WeekDay,
  WeekPlan,
  WorkoutLog,
} from "./types";
import "./styles.css";

const variants: Variant[] = ["full", "short", "primer"];

const planOverrideReasons = [
  "Manual labor",
  "Practice load",
  "Match moved",
  "Pickup replaced it",
  "Heavy legs",
  "Time constraint",
  "Recovery priority",
] as const;

type PendingSessionStart = {
  sessionId: SessionId;
  variant: Variant;
  dateKey: string;
  isoDate?: string;
};

type WorkoutSummary = {
  title: string;
  sets: string;
  load: number;
  progress: string;
  next: string;
};

type UndoNotice = {
  message: string;
  previousState: AppState;
};

const exerciseCues: Record<string, string[]> = {
  pogo: ["Stiff ankles. Quiet contacts.", "Stop if rhythm gets sloppy."],
  "front-squat": ["Tall chest. Brace before each rep.", "Drive up fast without grinding."],
  "back-squat": ["Explode up. Stop if bar speed dies.", "Leave 1-2 clean reps in reserve."],
  bulgarian: ["Control the descent.", "Push through the whole foot."],
  calf: ["Pause at the top.", "Full stretch at the bottom, no bouncing."],
  tib: ["Pull toes high.", "Control the lower back down."],
  core: ["Hips quiet.", "Move slow enough to keep the brace."],
  "pullup-warm": ["Crisp reps only.", "Save energy for the main work."],
  "bench-row": ["Bench with a deep stretch.", "Row without twisting your torso."],
  "incline-row": ["Own the bottom position.", "Pull elbows toward your hips."],
  raises: ["Light weight, clean path.", "No shrugging to finish reps."],
  pushup: ["Squeeze at the top.", "Stop one rep before form breaks."],
  bounds: ["Stick the landing.", "Push the ground away laterally."],
  rdl: ["Three-second lower.", "Hips back, spine locked in."],
  "hip-thrust": ["Ribs down.", "Full glute squeeze at lockout."],
  "single-rdl": ["Reach hips back.", "Keep the pelvis square."],
  "calf-volume": ["Smooth tempo.", "Use full range every rep."],
  hanging: ["No swinging.", "Curl the pelvis up at the top."],
  rkc: ["Squeeze glutes hard.", "Short, high-tension holds."],
  rope: ["Relax shoulders.", "Stay springy on the balls of your feet."],
  pullups: ["Strict reps.", "Control the lowering phase."],
  ohp: ["Brace ribs down.", "Press straight overhead."],
  "push-curl": ["Push-ups clean.", "Curl without rocking."],
  woodchop: ["Rotate through the trunk.", "Control the return."],
  walk: ["Nasal breathing if possible.", "Keep this easy."],
  mobility: ["Move slowly.", "Find range without forcing it."],
  "rope-light": ["Light contacts.", "Keep breathing relaxed."],
  primer: ["Quick feet, low fatigue.", "Finish feeling sharper."],
  "easy-cardio": ["Conversation pace.", "This should help recovery, not test it."],
  breathing: ["Longer exhale than inhale.", "Let your shoulders drop."],
};

function createSetLogs(exercise: Exercise, state: AppState, sessionId: SessionId): SetLog[] {
  const movements = getMovements(exercise);
  return Array.from({ length: exercise.sets }, (_, setIndex) => ({
    done: false,
    movements: Object.fromEntries(
      movements.map((movement) => {
        const suggestion = latestMovementSuggestion(state, sessionId, exercise.id, movement.id, setIndex);
        return [
          movement.id,
          {
            reps: suggestion?.reps || movement.reps,
            weight: suggestion?.weight || (movement.defaultWeight ? String(movement.defaultWeight) : ""),
          },
        ];
      })
    ),
  }));
}

function normalizeExerciseSetLogs(exercise: Exercise, existingSets?: SetLog[]): SetLog[] {
  const movements = getMovements(exercise);
  return Array.from({ length: exercise.sets }, (_, setIndex) => {
    const existing = Array.isArray(existingSets) ? existingSets[setIndex] : undefined;
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
}

function normalizeWorkoutSetLogs(sessionId: SessionId, variant: Variant, sets: Record<string, SetLog[]>): Record<string, SetLog[]> {
  const session = getSessionVariant(sessionId, variant);
  return Object.fromEntries(session.exercises.map((exercise) => [exercise.id, normalizeExerciseSetLogs(exercise, sets[exercise.id])]));
}

function latestMovementSuggestion(state: AppState, sessionId: SessionId, exerciseId: string, movementId: string, setIndex: number) {
  const latest = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).find((log) => log.sessionId === sessionId && log.variant === "full");
  const exact = latest?.sets[exerciseId]?.[setIndex]?.movements?.[movementId];
  if (exact?.reps || exact?.weight) return exact;
  return latest?.sets[exerciseId]?.find((set) => set.movements?.[movementId])?.movements[movementId];
}

function progressionGuidance(state: AppState, sessionId: SessionId, variant: Variant, exercise: Exercise) {
  if (variant !== "full") return ["Progression paused today. Match the target cleanly and keep fatigue low."];
  const latestFull = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).find((log) => log.sessionId === sessionId && log.variant === "full");
  if (!latestFull) return ["First full log for this session. Use the target, leave 1-2 reps in reserve, then progress next time."];

  const guidance = getMovements(exercise).map((movement) => {
    const completedSets = (latestFull.sets[exercise.id] ?? []).filter((set) => set.done && set.movements?.[movement.id]);
    if (!completedSets.length) return `${movement.name}: repeat the listed target until you have a complete full-session log.`;

    const logs = completedSets.map((set) => set.movements[movement.id]);
    const repValues = logs.map((log) => firstNumber(log.reps)).filter((value): value is number => value !== null);
    const weightValues = logs.map((log) => firstNumber(log.weight)).filter((value): value is number => value !== null);
    const lowestReps = repValues.length ? Math.min(...repValues) : null;
    const latestWeight = weightValues.length ? weightValues[0] : null;
    const range = repRange(movement.reps);

    if (latestFull.rating === "very_hard") return `${movement.name}: repeat or reduce next time; last full session was very hard.`;
    if (latestFull.rating === "hard") return `${movement.name}: repeat ${formatPrescription(latestWeight, lowestReps)} and make it cleaner.`;

    if (range && lowestReps !== null && lowestReps < range.max) {
      return `${movement.name}: try ${formatPrescription(latestWeight, lowestReps + 1)}.`;
    }

    if (movement.unit === "lb" && latestWeight !== null) {
      const nextWeight = latestWeight + weightIncrement(movement.name);
      return `${movement.name}: try ${formatPrescription(nextWeight, range?.min ?? lowestReps)}.`;
    }

    if (lowestReps !== null) return `${movement.name}: try ${lowestReps + 1} clean reps.`;
    return `${movement.name}: repeat the last full target with better control.`;
  });

  return guidance.slice(0, 3);
}

function firstNumber(value?: string) {
  const match = value?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function repRange(value: string) {
  const match = value.match(/(\d+)(?:-(\d+))?/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

function weightIncrement(name: string) {
  return /raise|curl|woodchop/i.test(name) ? 2.5 : 5;
}

function formatPrescription(weight: number | null, reps: number | null) {
  const weightText = weight !== null ? `${weight} lb` : "bodyweight";
  const repText = reps !== null ? `x ${reps}` : "for the target reps";
  return `${weightText} ${repText}`;
}

function buildWorkoutSummary(state: AppState, log: WorkoutLog): WorkoutSummary {
  const completed = Object.values(log.sets).flat().filter((set) => set.done).length;
  const total = getSessionVariant(log.sessionId, log.variant).exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const load = workoutLoad(log.sessionId, log.variant, log.rating);
  const progressed = countProgressedMovements(state, log);
  const progress = log.variant !== "full"
    ? "Progression paused for short or primer work."
    : progressed > 0
      ? `${progressed} movement${progressed === 1 ? "" : "s"} moved forward.`
      : "No clear progression flagged. Repeat or clean up the same targets next time.";
  const next = load >= 8 || log.rating === "very_hard"
    ? "Prioritize food, hydration, and lower-body recovery."
    : log.sessionId.startsWith("lower")
      ? "Keep tomorrow flexible around legs and soccer load."
      : "Good window for recovery breathing or easy mobility later.";

  return { title: log.sessionTitle, sets: `${completed}/${total} sets`, load, progress, next };
}

function defaultPlanOverrideReason(item: PlannedListItem, status: PlanOverrideStatus) {
  if (status === "replaced") {
    if (item.id === "game") return "Match moved";
    if (item.id === "practice") return "Practice load";
    if (item.id === "pickup") return "Pickup replaced it";
    return "Manual labor";
  }

  if (item.id === "game") return "Match moved";
  if (item.id === "practice" || item.id === "pickup") return "Time constraint";
  return "Recovery priority";
}

function normalizedPlanOverrideReason(item: PlannedListItem, status: PlanOverrideStatus) {
  const note = item.override?.note;
  if (note && planOverrideReasons.includes(note as (typeof planOverrideReasons)[number])) return note;
  return defaultPlanOverrideReason(item, status);
}

function countProgressedMovements(state: AppState, log: WorkoutLog) {
  if (log.variant !== "full") return 0;
  const previous = [...state.workouts]
    .filter((item) => item.id !== log.id && item.sessionId === log.sessionId && item.variant === "full" && item.date < log.date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!previous) return 0;

  const progressed = new Set<string>();
  Object.entries(log.sets).forEach(([exerciseId, sets]) => {
    sets.forEach((set, setIndex) => {
      if (!set.done) return;
      Object.entries(set.movements).forEach(([movementId, movement]) => {
        const previousMovement = previous.sets[exerciseId]?.[setIndex]?.movements?.[movementId];
        if (!previousMovement || didMovementProgress(movement, previousMovement)) progressed.add(`${exerciseId}-${movementId}`);
      });
    });
  });
  return progressed.size;
}

function didMovementProgress(current: MovementLog, previous: MovementLog) {
  const currentWeight = firstNumber(current.weight);
  const previousWeight = firstNumber(previous.weight);
  const currentReps = firstNumber(current.reps);
  const previousReps = firstNumber(previous.reps);
  if (currentWeight !== null && previousWeight !== null && currentWeight > previousWeight) return true;
  if (currentWeight !== null && previousWeight !== null && currentWeight < previousWeight) return false;
  return currentReps !== null && previousReps !== null && currentReps > previousReps;
}

function createDraft(state: AppState, sessionId: SessionId, variant: Variant, dateKey = todayKey(), isoDate?: string): ActiveWorkoutDraft {
  const session = getSessionVariant(sessionId, variant);
  return {
    sessionId,
    variant,
    activeExercise: 0,
    sets: Object.fromEntries(session.exercises.map((exercise) => [exercise.id, createSetLogs(exercise, state, sessionId)])),
    rating: "moderate",
    notes: "",
    touched: false,
    updatedAt: new Date().toISOString(),
    originalDate: isoDate ?? isoForDateKey(dateKey),
  };
}

function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [tab, setTab] = useState<Tab>("today");
  const [editingActivity, setEditingActivity] = useState<ActivityLog | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [activityDate, setActivityDate] = useState(todayKey());
  const [activityType, setActivityType] = useState<ActivityLog["activityType"]>("team_practice");
  const [pendingStart, setPendingStart] = useState<PendingSessionStart | null>(null);
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutSummary | null>(null);
  const [undoNotice, setUndoNotice] = useState<UndoNotice | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const recommendationRefreshKey = Math.floor(clockTick / (5 * 60 * 1000));
  const recommendation = useMemo(() => recommendSession(state, new Date()), [state, recommendationRefreshKey]);
  const draft = state.activeDraft ?? createDraft(state, "upper-a", "full");
  const activeSession = getSessionVariant(draft.sessionId, draft.variant);
  const currentExercise = activeSession.exercises[Math.min(draft.activeExercise, activeSession.exercises.length - 1)];
  const completedSets = Object.values(draft.sets).flat().filter((set) => set.done).length;
  const totalSets = activeSession.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  const restRemaining = draft.restEndsAt ? Math.max(0, Math.ceil((new Date(draft.restEndsAt).getTime() - clockTick) / 1000)) : 0;

  useEffect(() => {
    setStorageWarning(!saveState(state));
  }, [state]);


  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;
    const reloadOnControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnControllerChange);
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) setWaitingWorker(registration.waiting);
        registration.update().catch(() => undefined);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
          });
        });
      })
      .catch(() => undefined);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", reloadOnControllerChange);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setClockTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  function updateState(nextState: React.SetStateAction<AppState>, options?: { preserveUndo?: boolean }) {
    if (!options?.preserveUndo) setUndoNotice(null);
    setState(nextState);
  }

  function updateSettings(patch: Partial<AppState["settings"]>) {
    updateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...patch,
      },
    }));
  }

  function updateDraft(patch: Partial<ActiveWorkoutDraft>) {
    updateState((current) => ({
      ...current,
      activeDraft: {
        ...(current.activeDraft ?? draft),
        ...patch,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function buildWorkoutLogFromDraft(draftToSave: ActiveWorkoutDraft): WorkoutLog {
    const sessionToSave = getSessionVariant(draftToSave.sessionId, draftToSave.variant);
    return {
      id: draftToSave.editingWorkoutId ?? crypto.randomUUID(),
      date: draftToSave.originalDate ?? new Date().toISOString(),
      sessionId: draftToSave.sessionId,
      sessionTitle: sessionToSave.title,
      variant: draftToSave.variant,
      rating: draftToSave.rating,
      notes: draftToSave.notes,
      sets: draftToSave.sets,
      exercises: sessionToSave.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        movements: getMovements(exercise).map((movement) => ({ id: movement.id, name: movement.name, unit: movement.unit })),
      })),
    };
  }

  function replaceDraftWithSession(sessionId: SessionId, variant: Variant, dateKey = todayKey(), isoDate?: string) {
    updateState((current) => ({ ...current, activeDraft: createDraft(current, sessionId, variant, dateKey, isoDate) }));
    setTab("train");
  }

  function startSession(sessionId: SessionId, variant: Variant, dateKey = todayKey(), isoDate?: string) {
    const nextIsoDate = isoDate ?? isoForDateKey(dateKey);
    const currentDraft = state.activeDraft;
    const sameDraft = currentDraft?.sessionId === sessionId && currentDraft.variant === variant && todayKey(new Date(currentDraft.originalDate ?? new Date().toISOString())) === dateKey;
    if (currentDraft?.touched && sameDraft) {
      setTab("train");
      return;
    }
    if (currentDraft?.touched && !sameDraft) {
      setPendingStart({ sessionId, variant, dateKey, isoDate: nextIsoDate });
      return;
    }
    if (dateKey !== todayKey() && !window.confirm(`Start this workout for ${formatDisplayDate(dateKey)}?`)) return;
    replaceDraftWithSession(sessionId, variant, dateKey, nextIsoDate);
  }

  function saveDraftAndStartPending() {
    if (!pendingStart) return;
    if (completedSets === 0 && !window.confirm("Save the current workout with no completed sets?")) return;
    const log = buildWorkoutLogFromDraft(draft);
    const summary = buildWorkoutSummary(state, log);
    updateState((current) => ({
      ...current,
      workouts: [log, ...current.workouts.filter((item) => item.id !== log.id)].slice(0, 120),
      activeDraft: createDraft(current, pendingStart.sessionId, pendingStart.variant, pendingStart.dateKey, pendingStart.isoDate),
    }));
    setWorkoutSummary(summary);
    setPendingStart(null);
    setTab("train");
  }

  function discardDraftAndStartPending() {
    if (!pendingStart) return;
    replaceDraftWithSession(pendingStart.sessionId, pendingStart.variant, pendingStart.dateKey, pendingStart.isoDate);
    setPendingStart(null);
  }

  function startRecommendedSession() {
    if (!isTrainableSession(recommendation.session.id)) return;
    startSession(recommendation.session.id, recommendation.variant);
  }

  function updateMovement(exerciseId: string, setIndex: number, movementId: string, patch: Partial<MovementLog>) {
    const exercise = activeSession.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const movement = getMovements(exercise).find((item) => item.id === movementId);
    const fallbackMovement = movement ? { reps: movement.reps, weight: movement.defaultWeight ? String(movement.defaultWeight) : "" } : { reps: "", weight: "" };
    const exerciseSets = draft.sets[exerciseId] ?? normalizeExerciseSetLogs(exercise);
    updateDraft({
      touched: true,
      sets: {
        ...draft.sets,
        [exerciseId]: exerciseSets.map((set, index) =>
          index === setIndex
            ? { ...set, movements: { ...set.movements, [movementId]: { ...(set.movements[movementId] ?? fallbackMovement), ...patch } } }
            : set
        ),
      },
    });
  }

  function toggleSet(exerciseId: string, setIndex: number) {
    const exercise = activeSession.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    const exerciseSets = draft.sets[exerciseId] ?? normalizeExerciseSetLogs(exercise);
    const wasComplete = draft.sets[exerciseId]?.[setIndex]?.done;
    const nextExerciseSets = exerciseSets.map((set, index) => (index === setIndex ? { ...set, done: !set.done } : set));
    updateDraft({
      touched: true,
      restEndsAt: !wasComplete && exercise?.restSeconds ? new Date(Date.now() + exercise.restSeconds * 1000).toISOString() : draft.restEndsAt,
      restLabel: !wasComplete && exercise?.restSeconds ? `${exercise.name} set ${setIndex + 1}` : draft.restLabel,
      sets: {
        ...draft.sets,
        [exerciseId]: nextExerciseSets,
      },
    });
  }

  function advanceExercise() {
    updateDraft({ activeExercise: Math.min(activeSession.exercises.length - 1, draft.activeExercise + 1) });
  }

  function saveWorkout() {
    if (completedSets === 0 && !window.confirm("Save this workout with no completed sets?")) return;
    const log = buildWorkoutLogFromDraft(draft);
    const summary = buildWorkoutSummary(state, log);
    updateState((current) => ({
      ...current,
      workouts: [log, ...current.workouts.filter((item) => item.id !== log.id)].slice(0, 120),
      activeDraft: undefined,
    }));
    setWorkoutSummary(summary);
    setTab("history");
  }

  function setPlanOverride(dateKey: string, itemId: string, status: PlanOverrideStatus | null, note?: string) {
    const weekKey = trainingWeekKey(dateFromKey(dateKey));
    updateState((current) => {
      const currentWeek = current.planOverrides[weekKey] ?? {};
      const nextWeek = { ...currentWeek };
      if (status) {
        nextWeek[itemId] = {
          status,
          note: note || (status === "replaced" ? "Replaced by outside load or soccer work." : "Intentionally skipped."),
          updatedAt: new Date().toISOString(),
        };
      } else {
        delete nextWeek[itemId];
      }
      const nextOverrides = { ...current.planOverrides };
      if (Object.keys(nextWeek).length) nextOverrides[weekKey] = nextWeek;
      else delete nextOverrides[weekKey];
      return { ...current, planOverrides: nextOverrides };
    });
  }

  function applyUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }

  function saveActivity(activity: ActivityLog) {
    updateState((current) => ({
      ...current,
      activities: [activity, ...current.activities.filter((item) => item.id !== activity.id)].slice(0, 160),
    }));
    setEditingActivity(null);
  }

  function editLog(id: string) {
    const workout = state.workouts.find((log) => log.id === id);
    if (workout) {
      updateState((current) => ({
        ...current,
        activeDraft: {
          sessionId: workout.sessionId,
          variant: workout.variant ?? "full",
          activeExercise: 0,
          sets: normalizeWorkoutSetLogs(workout.sessionId, workout.variant ?? "full", workout.sets),
          rating: workout.rating,
          notes: workout.notes,
          touched: true,
          updatedAt: new Date().toISOString(),
          editingWorkoutId: workout.id,
          originalDate: workout.date,
        },
      }));
      setTab("train");
      return;
    }

    const activity = state.activities.find((log) => log.id === id);
    if (activity) {
      setEditingActivity(activity);
      setTab("activity");
    }
  }

  function deleteLog(id: string) {
    if (!window.confirm("Delete this entry?")) return;
    const deleted = [...state.workouts, ...state.activities].find((item) => item.id === id);
    setUndoNotice({ message: deleted ? `${latestLoadTitle(deleted)} deleted.` : "Entry deleted.", previousState: state });
    updateState((current) => ({
      ...current,
      workouts: current.workouts.filter((log) => log.id !== id),
      activities: current.activities.filter((log) => log.id !== id),
    }), { preserveUndo: true });
  }

  function resetApp() {
    if (!window.confirm("Clear all PitchForm data?")) return;
    setUndoNotice({ message: "All local data cleared.", previousState: state });
    updateState(defaultState, { preserveUndo: true });
  }

  function discardActiveDraft() {
    if (!state.activeDraft) return;
    if (!window.confirm("Discard the current workout draft?")) return;
    setUndoNotice({ message: "Workout draft discarded.", previousState: state });
    updateState((current) => ({ ...current, activeDraft: undefined }), { preserveUndo: true });
  }

  function importBackupState(nextState: AppState) {
    setUndoNotice({ message: "Backup imported.", previousState: state });
    updateState(nextState, { preserveUndo: true });
  }

  return (
    <main className="app-shell">
      <AppHeader state={state} />

      <nav className="tabbar" aria-label="Primary">
        <button className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}><Home size={18} /> Today</button>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}><CalendarDays size={18} /> Calendar</button>
        <button className={tab === "train" ? "active" : ""} onClick={() => setTab("train")}><Dumbbell size={18} /> Train</button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}><Plus size={18} /> Log</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={18} /> History</button>
      </nav>

      {waitingWorker ? <UpdateBanner onUpdate={applyUpdate} onDismiss={() => setWaitingWorker(null)} /> : null}
      {storageWarning ? <StorageWarningBanner onDismiss={() => setStorageWarning(false)} /> : null}
      {undoNotice ? (
        <UndoBanner
          message={undoNotice.message}
          onUndo={() => {
            setState(undoNotice.previousState);
            setUndoNotice(null);
          }}
          onDismiss={() => setUndoNotice(null)}
        />
      ) : null}
      {workoutSummary ? <WorkoutSummaryBanner summary={workoutSummary} onDismiss={() => setWorkoutSummary(null)} /> : null}

      {pendingStart && state.activeDraft ? (
        <DraftConflictDialog
          currentTitle={getSessionVariant(state.activeDraft.sessionId, state.activeDraft.variant).title}
          nextTitle={getSessionVariant(pendingStart.sessionId, pendingStart.variant).title}
          completedSets={completedSets}
          totalSets={totalSets}
          onResume={() => {
            setPendingStart(null);
            setTab("train");
          }}
          onSave={saveDraftAndStartPending}
          onDiscard={discardDraftAndStartPending}
          onCancel={() => setPendingStart(null)}
        />
      ) : null}

      {tab === "today" && (
        <TodayView
          state={state}
          recommendation={recommendation}
          onStart={startRecommendedSession}
          onLogMatch={() => {
            setActivityDate(todayKey());
            setActivityType("match");
            setEditingActivity(null);
            setTab("activity");
          }}
          onResume={() => setTab("train")}
          onSaveDraft={saveWorkout}
          onDiscardDraft={discardActiveDraft}
        />
      )}

      {tab === "calendar" && (
        <CalendarView
          state={state}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onSaveWeek={(dateKey, weekPlan) => {
            const weekKey = trainingWeekKey(dateFromKey(dateKey));
            const revision = { plan: weekPlan, updatedAt: new Date().toISOString() };
            updateState((current) => ({
              ...current,
              weekPlan: defaultWeekPlan,
              weekPlans: { ...current.weekPlans, [weekKey]: weekPlan },
              weekPlanRevisions: {
                ...current.weekPlanRevisions,
                [weekKey]: [...(current.weekPlanRevisions[weekKey] ?? []), revision].slice(-12),
              },
            }));
          }}
          onLogActivity={(dateKey, type) => {
            setEditingActivity(null);
            setActivityDate(dateKey);
            setActivityType(type);
            setTab("activity");
          }}
          onStartWorkout={(dateKey, sessionId, variant) => startSession(sessionId, variant, dateKey)}
          onPlanOverride={setPlanOverride}
          onEdit={editLog}
          onDelete={deleteLog}
        />
      )}

      {tab === "train" && (
        <TrainView
          state={state}
          draft={draft}
          activeSession={activeSession}
          currentExercise={currentExercise}
          completedSets={completedSets}
          totalSets={totalSets}
          restRemaining={restRemaining}
          restLabel={draft.restLabel ?? ""}
          timerAlerts={state.settings.timerAlerts}
          onStartSession={startSession}
          onUpdateDraft={updateDraft}
          onUpdateMovement={updateMovement}
          onToggleSet={toggleSet}
          onAdvance={advanceExercise}
          onSave={saveWorkout}
          onStopRest={() => updateDraft({ restEndsAt: undefined, restLabel: undefined })}
          onStartRest={() => {
            if (currentExercise.restSeconds) {
              updateDraft({
                restEndsAt: new Date(Date.now() + currentExercise.restSeconds * 1000).toISOString(),
                restLabel: currentExercise.name,
              });
            }
          }}
        />
      )}

      {tab === "activity" && <ActivityForm initialActivity={editingActivity} defaultDate={activityDate} defaultType={activityType} onSave={saveActivity} onCancel={() => setEditingActivity(null)} />}
      {tab === "history" && (
        <HistoryView
          state={state}
          onDelete={deleteLog}
          onEdit={editLog}
          onExport={() => exportState(state)}
          onImport={importBackupState}
          onReset={resetApp}
          onUpdateSettings={updateSettings}
        />
      )}
    </main>
  );
}

function AppHeader({ state }: { state: AppState }) {
  const latest = [...state.workouts, ...state.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <p className="eyebrow">PitchForm</p>
      </div>
      <div className="header-stats" aria-label="Training summary">
        <HeaderStat label="Recent Load" value={`${recentLoad(state)}/12`} />
        <HeaderStat label="Latest Load" value={latest ? latestLoadTitle(latest) : "None"} />
        <HeaderStat label="Workouts Logged" value={state.workouts.length.toString()} />
      </div>
    </header>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return <div className="header-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function UpdateBanner({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  return (
    <article className="update-strip">
      <div><strong>App update ready</strong><span>Reload to use the newest saved version.</span></div>
      <button type="button" onClick={onUpdate}><RefreshCw size={18} /> Update</button>
      <button type="button" onClick={onDismiss}>Later</button>
    </article>
  );
}

function StorageWarningBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <article className="storage-strip">
      <div><strong>Local saves are blocked</strong><span>Your latest changes may not stay on this device. Export a backup before closing the app.</span></div>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </article>
  );
}

function UndoBanner({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  return (
    <article className="undo-strip">
      <div><strong>{message}</strong><span>You can restore the previous data snapshot.</span></div>
      <button type="button" onClick={onUndo}>Undo</button>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </article>
  );
}

function WorkoutSummaryBanner({ summary, onDismiss }: { summary: WorkoutSummary; onDismiss: () => void }) {
  return (
    <article className="summary-strip">
      <div className="section-head">
        <div><p className="eyebrow">Workout Saved</p><h2>{summary.title}</h2></div>
        <button type="button" onClick={onDismiss}>Close</button>
      </div>
      <div className="summary-grid">
        <span><strong>{summary.sets}</strong>Completed</span>
        <span><strong>{summary.load}/10</strong>Load</span>
      </div>
      <p>{summary.progress}</p>
      <p>{summary.next}</p>
    </article>
  );
}

function DraftConflictDialog({ currentTitle, nextTitle, completedSets, totalSets, onResume, onSave, onDiscard, onCancel }: { currentTitle: string; nextTitle: string; completedSets: number; totalSets: number; onResume: () => void; onSave: () => void; onDiscard: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="draft-conflict-title">
        <div>
          <p className="eyebrow">Workout in progress</p>
          <h2 id="draft-conflict-title">Keep your current draft?</h2>
          <p>You have {currentTitle} in progress with {completedSets}/{totalSets} sets checked. You tried to start {nextTitle}.</p>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onResume}><Dumbbell size={18} /> Resume Current</button>
          <button type="button" onClick={onSave}><Save size={18} /> Save Then Start</button>
          <button type="button" onClick={onDiscard}><Trash2 size={18} /> Discard Draft</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function TodayView({ state, recommendation, onStart, onLogMatch, onResume, onSaveDraft, onDiscardDraft }: { state: AppState; recommendation: ReturnType<typeof recommendSession>; onStart: () => void; onLogMatch: () => void; onResume: () => void; onSaveDraft: () => void; onDiscardDraft: () => void }) {
  return (
    <section className="stack">
      {state.activeDraft?.touched ? (
        <article className="resume-strip">
          <div>
            <strong>Workout draft saved</strong>
            <span>{sessions[state.activeDraft.sessionId].title} · {state.activeDraft.variant}</span>
          </div>
          <div className="draft-actions" aria-label="Workout draft actions">
            <button type="button" onClick={onResume} aria-label="Resume workout"><Play size={18} /></button>
            <button type="button" onClick={onSaveDraft} aria-label="Save workout draft"><Save size={18} /></button>
            <button type="button" onClick={onDiscardDraft} aria-label="Discard workout draft"><Trash2 size={18} /></button>
          </div>
        </article>
      ) : null}
      <article className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Today's Recommendation</p>
          <h2>{recommendation.session.title}</h2>
          <p>{recommendation.session.summary}</p>
        </div>
        <div className="metric-row">
          <span><TimerReset size={18} /> {recommendation.session.duration}</span>
          <span><Flame size={18} /> Load {recommendation.session.load}/10</span>
          <span>{recommendation.variant}</span>
        </div>
        <div className="reason-box"><strong>Why</strong><p>{recommendation.reason}</p></div>
        <div className="reason-box subtle"><strong>Note</strong><p>{recommendation.caution}</p></div>
        {isTrainableSession(recommendation.session.id) ? (
          <button className="primary-btn" onClick={onStart}>Start Session <ChevronRight size={20} /></button>
        ) : (
          <button className="primary-btn" onClick={onLogMatch}>Log Match Afterward <ChevronRight size={20} /></button>
        )}
      </article>
      <RecentActivity state={state} />
    </section>
  );
}

function CalendarView({ state, selectedDate, onSelectDate, onSaveWeek, onLogActivity, onStartWorkout, onPlanOverride, onEdit, onDelete }: { state: AppState; selectedDate: string; onSelectDate: (date: string) => void; onSaveWeek: (dateKey: string, weekPlan: WeekPlan) => void; onLogActivity: (dateKey: string, type: ActivityLog["activityType"]) => void; onStartWorkout: (dateKey: string, sessionId: SessionId, variant: Variant) => void; onPlanOverride: (dateKey: string, itemId: string, status: PlanOverrideStatus | null, note?: string) => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  const [quickActivityType, setQuickActivityType] = useState<ActivityLog["activityType"]>("team_practice");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const selectedEntries = entriesForDate(state, selectedDate);
  const selectedState = stateThroughDate(state, selectedDate);
  const selectedRecommendationDate = dateForRecommendation(selectedDate);
  const selectedRecommendation = recommendSession(selectedState, selectedRecommendationDate);
  const selectedPlannedItems = plannedItemsForDate(selectedState, selectedDate);
  const selectedPlannedWorkout = selectedPlannedItems.find((item): item is PlannedListItem & { id: SessionId } => item.id in sessions);
  const selectedSessionId = selectedPlannedWorkout
    ? selectedPlannedWorkout.id
    : isTrainableSession(selectedRecommendation.session.id)
      ? selectedRecommendation.session.id
      : "activation";
  const selectedVariant = selectedPlannedWorkout?.variant ?? selectedRecommendation.variant;
  const selectedLoad = recentLoad(selectedState, selectedRecommendationDate);
  function moveMonth(delta: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }
  function jumpToToday() {
    const now = new Date();
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(todayKey(now));
  }
  return (
    <section className="stack">
      <article className="plain-panel">
        <div className="section-head">
          <div><p className="eyebrow">Calendar</p><h2>{formatMonthTitle(visibleMonth)}</h2></div>
          <div className="calendar-controls">
            <button aria-label="Previous month" onClick={() => moveMonth(-1)}><ChevronLeft size={18} /></button>
            <button className="today-control" type="button" onClick={jumpToToday}>Today</button>
            <button aria-label="Next month" onClick={() => moveMonth(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
        <CalendarGrid month={visibleMonth} state={state} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      </article>
      <article className="plain-panel">
        <div className="section-head"><div><p className="eyebrow">Selected Day</p><h2>{formatDisplayDate(selectedDate)}</h2></div></div>
        <div className="history-list">
          {selectedEntries.map((item) => (
            <div className="history-item compact" key={item.id}>
              <div className="entry-actions">
                <button type="button" onClick={() => onEdit(item.id)} aria-label="Edit entry"><Pencil size={16} /></button>
                <button type="button" onClick={() => onDelete(item.id)} aria-label="Delete entry"><Trash2 size={16} /></button>
              </div>
              <strong>{"sessionTitle" in item ? item.sessionTitle : activityLabels[item.activityType]}</strong>
              <span>{new Date(item.date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span>
              <p>{"sessionTitle" in item ? `${effortLabels[item.rating]} · ${item.variant}` : `${item.durationMinutes || "0"} min, ${effortLabels[item.effort]}, legs ${legLabels[item.legs].toLowerCase()}`}</p>
              {"sessionTitle" in item ? <WorkoutDetails log={item} /> : <ActivityDetails log={item} />}
            </div>
          ))}
          {selectedEntries.length === 0 ? <p>No entries for this day.</p> : null}
        </div>
        <div className="selected-recommendation">
          <p className="eyebrow">{selectedPlannedItems.length ? "Calendar Plan" : "Recommendation"}</p>
          {selectedPlannedItems.length ? (
            <>
              <strong>{selectedPlannedItems.map((item) => `${item.label}${item.variant ? ` · ${item.variant}` : ""}`).join(" + ")}</strong>
              <p>{selectedEntries.length ? "This day has saved work. The calendar badge reflects what you logged." : "This is the planned work for the selected calendar date."}</p>
            </>
          ) : (
            <>
              <strong>{selectedRecommendation.session.title} · {selectedRecommendation.variant}</strong>
              <p>{selectedRecommendation.reason}</p>
            </>
          )}
          <span>Recent load {selectedLoad}/12</span>
        </div>
        <div className="day-actions">
          <label className="action-select">Activity<select value={quickActivityType} onChange={(event) => setQuickActivityType(event.target.value as ActivityLog["activityType"])}>{Object.entries(activityLabels).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
          <button type="button" onClick={() => onLogActivity(selectedDate, quickActivityType)}><Plus size={18} /> Log Activity</button>
          <button className="wide-action" type="button" onClick={() => onStartWorkout(selectedDate, selectedSessionId, selectedVariant)}><Dumbbell size={18} /> Start {sessions[selectedSessionId].title}</button>
        </div>
      </article>
      <WeekView state={selectedState} dateKey={selectedDate} onSave={onSaveWeek} onPlanOverride={onPlanOverride} />
    </section>
  );
}

function CalendarGrid({ month, state, selectedDate, onSelectDate }: { month: Date; state: AppState; selectedDate: string; onSelectDate: (date: string) => void }) {
  const today = todayKey();
  const monthDays = getVisibleCalendarDays(month);
  return (
    <div className="calendar-grid">
      {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <span className="calendar-weekday" key={`${label}-${index}`}>{label}</span>)}
      {monthDays.map((date) => {
        const key = todayKey(date);
        const entryCount = entriesForDate(state, key).length;
        const calendarLabels = calendarLabelsForDate(state, key);
        return (
          <button
            key={key}
            className={`calendar-day ${date.getMonth() !== month.getMonth() ? "muted" : ""} ${key === today ? "today" : ""} ${key === selectedDate ? "selected" : ""} ${calendarLabels.length ? "planned" : ""}`}
            onClick={() => onSelectDate(key)}
            aria-label={`${formatDisplayDate(key)}${calendarLabels.length ? `, ${entryCount ? "logged" : "planned"} ${calendarLabels.join(", ")}` : ""}${entryCount ? `, ${entryCount} logged` : ""}`}
          >
            <span>{date.getDate()}</span>
            {calendarLabels.length ? <small>{calendarLabels.slice(0, 2).join(" + ")}</small> : null}
            {entryCount ? <b>{entryCount}</b> : null}
          </button>
        );
      })}
    </div>
  );
}

function WeekView({ state, dateKey, onSave, onPlanOverride }: { state: AppState; dateKey: string; onSave: (dateKey: string, weekPlan: WeekPlan) => void; onPlanOverride: (dateKey: string, itemId: string, status: PlanOverrideStatus | null, note?: string) => void }) {
  const selectedWeekDate = dateFromKey(dateKey);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  function markPlanItem(item: PlannedListItem, status: PlanOverrideStatus | null) {
    if (!status) {
      onPlanOverride(dateKey, item.id, null);
      return;
    }
    const plannedDateKey = item.day === "none" ? dateKey : dateKeyForWeekDay(selectedWeekDate, item.day);
    if (plannedDateKey > todayKey() && !window.confirm(`Mark ${item.label} as ${status} before its planned day?`)) return;
    onPlanOverride(dateKey, item.id, status, overrideReasons[item.id] ?? normalizedPlanOverrideReason(item, status));
  }
  return (
    <section className="stack">
      <WeekSetup dateKey={dateKey} weekPlan={getWeekPlan(state, selectedWeekDate)} onSave={onSave} />
      <article className="plain-panel">
        <div className="section-head"><div><p className="eyebrow">Weekly Checklist</p><h2>{trainingWeekKey(selectedWeekDate) === trainingWeekKey() ? "This Week" : "Selected Week"}</h2></div><CalendarDays size={22} /></div>
        <div className="plan-list">
          {buildWeeklyPlan(state, selectedWeekDate).filter((item) => item.id !== "practice" && item.id !== "pickup" && item.id !== "game").map((item) => (
            <div className={`plan-item ${item.status}`} key={`${item.id}-${item.day}`}>
              <span>{item.status === "complete" ? "Done" : item.status === "moved" ? "Moved" : item.status === "skipped" ? "Skipped" : item.status === "replaced" ? "Replaced" : item.status === "missed" ? "Missed" : item.status === "today" ? "Today" : item.status === "none" ? "Off" : "Open"}</span>
              <strong>{item.label}</strong>
              <p>{formatPlanItemDay(item)}{item.override ? ` · ${normalizedPlanOverrideReason(item, item.override.status)}` : ""}</p>
              {item.day !== "none" && item.status !== "complete" && item.status !== "moved" ? (
                <div className="plan-actions">
                  <label>Reason<select value={overrideReasons[item.id] ?? (item.override ? normalizedPlanOverrideReason(item, item.override.status) : defaultPlanOverrideReason(item, "skipped"))} onChange={(event) => setOverrideReasons((current) => ({ ...current, [item.id]: event.target.value }))}>{planOverrideReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label>
                  {item.override ? <button type="button" onClick={() => markPlanItem(item, null)}>Clear</button> : null}
                  <button type="button" onClick={() => markPlanItem(item, "skipped")}>Skip</button>
                  <button type="button" onClick={() => markPlanItem(item, "replaced")}>Replace</button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function TrainView(props: {
  state: AppState;
  draft: ActiveWorkoutDraft;
  activeSession: ReturnType<typeof getSessionVariant>;
  currentExercise: Exercise;
  completedSets: number;
  totalSets: number;
  restRemaining: number;
  restLabel: string;
  timerAlerts: boolean;
  onStartSession: (id: SessionId, variant: Variant, dateKey?: string, isoDate?: string) => void;
  onUpdateDraft: (patch: Partial<ActiveWorkoutDraft>) => void;
  onUpdateMovement: (exerciseId: string, setIndex: number, movementId: string, patch: Partial<MovementLog>) => void;
  onToggleSet: (exerciseId: string, setIndex: number) => void;
  onAdvance: () => void;
  onSave: () => void;
  onStopRest: () => void;
  onStartRest: () => void;
}) {
  const exerciseIndex = props.draft.activeExercise;
  const cues = exerciseCues[props.currentExercise.id] ?? ["Move with control.", "Leave clean reps in reserve."];
  const progression = progressionGuidance(props.state, props.draft.sessionId, props.draft.variant, props.currentExercise);
  return (
    <section className="stack">
      <SessionPicker activeSessionId={props.draft.sessionId} variant={props.draft.variant} dateKey={todayKey()} onSelect={props.onStartSession} />
      <article className="workout-card">
        <div className="workout-head">
          <div><p className="eyebrow">{props.activeSession.category} · {props.draft.variant}</p><h2>{props.activeSession.title}</h2></div>
          <span className="progress-chip">{props.completedSets}/{props.totalSets} sets</span>
        </div>
        <div className="progress-track"><div style={{ width: `${Math.round((props.completedSets / Math.max(props.totalSets, 1)) * 100)}%` }} /></div>
        <div className="exercise-panel">
          <div className="exercise-nav">
            <button aria-label="Previous exercise" onClick={() => props.onUpdateDraft({ activeExercise: Math.max(0, exerciseIndex - 1) })} disabled={exerciseIndex === 0}><ChevronLeft size={20} /></button>
            <span>{exerciseIndex + 1} of {props.activeSession.exercises.length}</span>
            <button aria-label="Next exercise" onClick={props.onAdvance} disabled={exerciseIndex === props.activeSession.exercises.length - 1}><ChevronRight size={20} /></button>
          </div>
          <h3>{props.currentExercise.name}</h3>
          <p className="target">{props.currentExercise.target}</p>
          <div className="coach-panel">
            <div>
              <p className="eyebrow">Cues</p>
              <ul>{cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
            </div>
            <div>
              <p className="eyebrow">Next Target</p>
              <ul>{progression.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          </div>
          {props.currentExercise.restSeconds ? <p className="rest"><TimerReset size={16} /> Rest {props.currentExercise.restSeconds}s after each set</p> : null}
          {getMovements(props.currentExercise).length > 1 ? <p className="superset-note">Log each movement before marking the round complete.</p> : null}
          <RestTimer label={props.restLabel} seconds={props.restRemaining} alertsEnabled={props.timerAlerts} onStart={props.onStartRest} onStop={props.onStopRest} />
          <div className="set-list">
            {(props.draft.sets[props.currentExercise.id] ?? []).map((set, index) => (
              <div className="set-row" key={`${props.currentExercise.id}-${index}`}>
                <button className={set.done ? "check-btn complete" : "check-btn"} aria-label={`Complete set ${index + 1}`} onClick={() => props.onToggleSet(props.currentExercise.id, index)}><Check size={18} /></button>
                <div className="set-fields">
                  <span className="set-label">Set {index + 1}</span>
                  {getMovements(props.currentExercise).map((movement) => {
                    const movementLog = set.movements[movement.id] ?? { reps: movement.reps, weight: "" };
                    return (
                      <div className="movement-fields" key={movement.id}>
                        <strong>{movement.name}</strong>
                        <label>Reps<input value={movementLog.reps} onChange={(event) => props.onUpdateMovement(props.currentExercise.id, index, movement.id, { reps: event.target.value })} inputMode="numeric" /></label>
                        <label>Weight<input value={movementLog.weight} onChange={(event) => props.onUpdateMovement(props.currentExercise.id, index, movement.id, { weight: event.target.value })} inputMode="decimal" placeholder={movement.unit === "lb" ? "lb" : "-"} /></label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button className="secondary-btn" onClick={props.onAdvance} disabled={exerciseIndex === props.activeSession.exercises.length - 1}>Next Exercise</button>
        </div>
        <div className="rating-box">
          <div className="field-grid date-time-grid">
            <label>Workout date<input type="date" value={todayKey(new Date(props.draft.originalDate ?? new Date().toISOString()))} onChange={(event) => props.onUpdateDraft({ originalDate: isoForDateKey(event.target.value, timeFromIso(props.draft.originalDate)), touched: true })} /></label>
            <label>Time<input type="time" value={timeFromIso(props.draft.originalDate)} onChange={(event) => props.onUpdateDraft({ originalDate: isoForDateKey(todayKey(new Date(props.draft.originalDate ?? new Date().toISOString())), event.target.value), touched: true })} /></label>
          </div>
          <label>Session feel<select value={props.draft.rating} onChange={(event) => props.onUpdateDraft({ rating: event.target.value as Effort, touched: true })}>{Object.entries(effortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Notes<textarea value={props.draft.notes} onChange={(event) => props.onUpdateDraft({ notes: event.target.value, touched: true })} placeholder="Heavy legs, sharp, skipped a set..." /></label>
        </div>
        <button className="primary-btn" onClick={props.onSave}><Save size={20} /> Save Workout</button>
      </article>
    </section>
  );
}

function WeekSetup({ dateKey, weekPlan, onSave }: { dateKey: string; weekPlan: WeekPlan; onSave: (dateKey: string, weekPlan: WeekPlan) => void }) {
  const [draft, setDraft] = useState<WeekPlan>(weekPlan);
  const weekLabel = trainingWeekKey(dateFromKey(dateKey)) === trainingWeekKey() ? "Current Week" : "Selected Week";
  useEffect(() => setDraft(weekPlan), [weekPlan]);
  return (
    <article className="form-card">
      <div className="section-head"><div><p className="eyebrow">{weekLabel}</p><h2>{formatWeekRange(dateKey)}</h2></div><CalendarDays size={22} /></div>
      <div className="field-grid">
        <label>Team practice<select value={draft.practiceDay} onChange={(event) => setDraft((current) => ({ ...current, practiceDay: parseOptionalDay(event.target.value) }))}><option value="none">No practice</option>{Object.entries(dayLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Game day<select value={draft.gameDay} onChange={(event) => setDraft((current) => ({ ...current, gameDay: parseOptionalDay(event.target.value) }))}><option value="none">No game</option>{Object.entries(dayLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <label>Pickup<select value={draft.pickupDay} onChange={(event) => setDraft((current) => ({ ...current, pickupDay: parseOptionalDay(event.target.value) }))}><option value="none">None this week</option>{Object.entries(dayLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="primary-btn" onClick={() => onSave(dateKey, draft)}><Save size={20} /> Save Week</button>
    </article>
  );
}

function SessionPicker({ activeSessionId, variant, dateKey, isoDate, onSelect }: { activeSessionId: SessionId; variant: Variant; dateKey: string; isoDate?: string; onSelect: (id: SessionId, variant: Variant, dateKey?: string, isoDate?: string) => void }) {
  return (
    <div className="session-tools">
      <div className="session-picker" aria-label="Workout sessions">{Object.values(sessions).map((session) => <button key={session.id} className={activeSessionId === session.id ? "active" : ""} onClick={() => onSelect(session.id, variant, dateKey, isoDate)}>{session.title}</button>)}</div>
      <div className="variant-picker" aria-label="Session variant">{variants.map((item) => <button key={item} className={variant === item ? "active" : ""} onClick={() => onSelect(activeSessionId, item, dateKey, isoDate)}>{item}</button>)}</div>
    </div>
  );
}

const emptyActivity = (dateKey = todayKey(), activityType: ActivityLog["activityType"] = "team_practice"): ActivityLog => ({
    id: crypto.randomUUID(),
    date: isoForDateKey(dateKey),
    activityType,
    durationMinutes: "90",
    effort: "moderate",
    legs: "normal",
    averageHeartRate: "",
    maximumHeartRate: "",
    activeCalories: "",
    distanceMiles: "",
    notes: "",
  });

function ActivityForm({ initialActivity, defaultDate, defaultType, onSave, onCancel }: { initialActivity: ActivityLog | null; defaultDate: string; defaultType: ActivityLog["activityType"]; onSave: (activity: ActivityLog) => void; onCancel: () => void }) {
  const [activity, setActivity] = useState<ActivityLog>(emptyActivity);

  useEffect(() => {
    setActivity(initialActivity ?? emptyActivity(defaultDate, defaultType));
  }, [defaultDate, defaultType, initialActivity]);

  function update(patch: Partial<ActivityLog>) {
    setActivity((current) => ({
      ...current,
      ...patch,
      ...(patch.activityType === "match" ? { averageHeartRate: "", maximumHeartRate: "", activeCalories: "", distanceMiles: "" } : {}),
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSave({ ...activity, id: initialActivity?.id ?? crypto.randomUUID() });
    setActivity(emptyActivity(defaultDate, defaultType));
  }

  return (
    <section className="stack"><article className="form-card">
      <div className="section-head"><div><p className="eyebrow">Activity Log</p><h2>Record Outside Load</h2></div><HeartPulse size={22} /></div>
      <form onSubmit={submit}>
        <label>Activity<select value={activity.activityType} onChange={(event) => update({ activityType: event.target.value as ActivityLog["activityType"] })}>{Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="field-grid date-time-grid">
          <label>Date<input type="date" value={todayKey(new Date(activity.date))} onChange={(event) => update({ date: isoForDateKey(event.target.value, timeFromIso(activity.date)) })} /></label>
          <label>Time<input type="time" value={timeFromIso(activity.date)} onChange={(event) => update({ date: isoForDateKey(todayKey(new Date(activity.date)), event.target.value) })} /></label>
        </div>
        <div className="field-grid">
          <label>Duration<input value={activity.durationMinutes} onChange={(event) => update({ durationMinutes: event.target.value })} inputMode="numeric" type="number" min="0" /></label>
          <label>Effort<select value={activity.effort} onChange={(event) => update({ effort: event.target.value as Effort })}>{Object.entries(effortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <label>Legs afterward<select value={activity.legs} onChange={(event) => update({ legs: event.target.value as ActivityLog["legs"] })}>{Object.entries(legLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {activity.activityType !== "match" ? (
          <div className="watch-fields"><p className="eyebrow">Optional Apple Watch Summary</p><div className="field-grid">
            <label>Avg HR<input value={activity.averageHeartRate} onChange={(event) => update({ averageHeartRate: event.target.value })} inputMode="numeric" type="number" min="0" max="240" /></label>
            <label>Max HR<input value={activity.maximumHeartRate} onChange={(event) => update({ maximumHeartRate: event.target.value })} inputMode="numeric" type="number" min="0" max="240" /></label>
            <label>Calories<input value={activity.activeCalories} onChange={(event) => update({ activeCalories: event.target.value })} inputMode="numeric" type="number" min="0" /></label>
            <label>Distance mi<input value={activity.distanceMiles} onChange={(event) => update({ distanceMiles: event.target.value })} inputMode="decimal" type="number" min="0" step="0.01" /></label>
          </div></div>
        ) : null}
        <label>Notes<textarea value={activity.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="Practice was tactical, manual labor all day, cramped late..." /></label>
        <button className="primary-btn" type="submit"><Save size={20} /> {initialActivity ? "Update Activity" : "Save Activity"}</button>
        {initialActivity ? <button className="secondary-btn" type="button" onClick={() => { onCancel(); setActivity(emptyActivity(defaultDate, defaultType)); }}>Cancel Edit</button> : null}
      </form>
    </article></section>
  );
}

function RecentActivity({ state }: { state: AppState }) {
  const latest = [...state.workouts, ...state.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <article className="plain-panel">
      <div className="section-head"><div><p className="eyebrow">Latest Load</p><h2>{latest ? latestLoadTitle(latest) : "Nothing logged yet"}</h2></div><CalendarDays size={20} /></div>
      {latest ? <p>{latestLoadSummary(latest)}</p> : <p>Log practice, matches, pickup, conditioning, demanding manual labor, or workouts so recommendations can adjust.</p>}
    </article>
  );
}

function latestLoadTitle(item: WorkoutLog | ActivityLog) {
  return "sessionTitle" in item ? item.sessionTitle : activityLabels[item.activityType];
}

function latestLoadSummary(item: WorkoutLog | ActivityLog) {
  if ("sessionTitle" in item) return `${effortLabels[item.rating]} · ${item.variant} workout.`;
  return `${item.durationMinutes || "0"} min, ${effortLabels[item.effort]}, legs ${legLabels[item.legs].toLowerCase()}.`;
}

function HistoryView({ state, onDelete, onEdit, onExport, onImport, onReset, onUpdateSettings }: { state: AppState; onDelete: (id: string) => void; onEdit: (id: string) => void; onExport: () => void; onImport: (state: AppState) => void; onReset: () => void; onUpdateSettings: (patch: Partial<AppState["settings"]>) => void }) {
  return (
    <section className="stack">
    <article className="plain-panel">
      <div className="section-head"><div><p className="eyebrow">History</p><h2>Recent Work</h2></div><History size={22} /></div>
      <div className="history-list">
        {[...state.workouts, ...state.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40).map((item) => (
          <div className="history-item" key={item.id}>
            <div className="entry-actions">
              <button onClick={() => onEdit(item.id)} aria-label="Edit entry"><Pencil size={16} /></button>
              <button onClick={() => onDelete(item.id)} aria-label="Delete entry"><Trash2 size={16} /></button>
            </div>
            <strong>{"sessionTitle" in item ? item.sessionTitle : activityLabels[item.activityType]}</strong>
            <span>{new Date(item.date).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
            <p>{"sessionTitle" in item ? `${effortLabels[item.rating]} · ${item.variant}` : `${item.durationMinutes || "0"} min, ${effortLabels[item.effort]}, legs ${legLabels[item.legs].toLowerCase()}`}</p>
            {"sessionTitle" in item ? <WorkoutDetails log={item} /> : <ActivityDetails log={item} />}
          </div>
        ))}
        {state.workouts.length === 0 && state.activities.length === 0 ? <p>No saved entries yet.</p> : null}
      </div>
    </article>
    <SettingsView state={state} onExport={onExport} onImport={onImport} onReset={onReset} onUpdateSettings={onUpdateSettings} onTestTimerAlert={notifyRestComplete} />
    </section>
  );
}

function WorkoutDetails({ log }: { log: WorkoutLog }) {
  const session = sessions[log.sessionId];
  const loggedExercises: LoggedExercise[] = log.exercises?.length
    ? log.exercises
    : session.exercises.map((exercise) => ({ id: exercise.id, name: exercise.name, movements: getMovements(exercise).map((movement) => ({ id: movement.id, name: movement.name, unit: movement.unit })) }));
  return (
    <details className="entry-details"><summary>Set details</summary><div className="detail-list">
      {loggedExercises.map((exercise) => {
        const setLogs = log.sets[exercise.id] ?? [];
        return <div key={exercise.id}><b>{exercise.name}</b>{setLogs.map((set, index) => <p key={`${exercise.id}-${index}`}>Set {index + 1}: {formatSetLog(exercise, set)}</p>)}</div>;
      })}
      {log.notes ? <p>Notes: {log.notes}</p> : null}
    </div></details>
  );
}

function ActivityDetails({ log }: { log: ActivityLog }) {
  const watchStats = log.activityType === "match" ? [] : [log.averageHeartRate ? `Avg HR ${log.averageHeartRate}` : "", log.maximumHeartRate ? `Max HR ${log.maximumHeartRate}` : "", log.activeCalories ? `${log.activeCalories} cal` : "", log.distanceMiles ? `${log.distanceMiles} mi` : ""].filter(Boolean);
  if (!watchStats.length && !log.notes) return null;
  return <details className="entry-details"><summary>Details</summary>{watchStats.length ? <p>{watchStats.join(" · ")}</p> : null}{log.notes ? <p>{log.notes}</p> : null}</details>;
}

function SettingsView({ state, onExport, onImport, onReset, onUpdateSettings, onTestTimerAlert }: { state: AppState; onExport: () => void; onImport: (state: AppState) => void; onReset: () => void; onUpdateSettings: (patch: Partial<AppState["settings"]>) => void; onTestTimerAlert: () => void }) {
  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const normalized = normalizeState(JSON.parse(await file.text()));
      if (!normalized) return window.alert("That backup file is not valid.");
      if (!window.confirm("Import this backup and replace the data currently on this device?")) return;
      onImport(normalized);
    } catch {
      window.alert("That backup file could not be imported.");
    } finally {
      event.target.value = "";
    }
  }
  return (
    <section className="stack"><article className="plain-panel">
      <div className="section-head"><div><p className="eyebrow">Settings</p><h2>Data & Backup</h2></div><Settings size={22} /></div>
      <div className="backup-actions">
        <button type="button" onClick={onExport}>Export Backup</button>
        <label>Import Backup<input type="file" accept="application/json" onChange={importBackup} /></label>
        <button type="button" onClick={onReset}>Reset App</button>
      </div>
      <label className="toggle-row">
        <input type="checkbox" checked={state.settings.timerAlerts} onChange={(event) => onUpdateSettings({ timerAlerts: event.target.checked })} />
        Rest timer vibration and sound
      </label>
      <button className="secondary-btn compact-btn" type="button" disabled={!state.settings.timerAlerts} onClick={onTestTimerAlert}>Test Timer Alert</button>
      <p>{state.workouts.length} workouts, {state.activities.length} activities saved on this device.</p>
    </article></section>
  );
}

function formatSetLog(exercise: LoggedExercise, set: SetLog) {
  return exercise.movements.map((movement) => {
    const movementLog = set.movements?.[movement.id];
    if (!movementLog) return `${movement.name} not logged`;
    const weight = movementLog.weight ? ` @ ${movementLog.weight}${movement.unit === "lb" ? " lb" : ""}` : "";
    return `${movement.name} ${movementLog.reps || "-"}${weight}`;
  }).join("; ");
}

function entriesForDate(state: AppState, dateKey: string) {
  return [...state.workouts, ...state.activities]
    .filter((item) => todayKey(new Date(item.date)) === dateKey)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function formatPlanItemDay(item: ReturnType<typeof buildWeeklyPlan>[number]) {
  if (item.day === "none") return "Not scheduled";
  if (item.status === "moved" && item.completedDate) return `Planned ${dayLabels[item.day]} · done ${shortDateLabel(item.completedDate)}`;
  return dayLabels[item.day];
}

createRoot(document.getElementById("root")!).render(<App />);
