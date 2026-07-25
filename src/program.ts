import type { Exercise, Movement, SessionId, TrainingSession, Variant } from "./types";

export const sessions: Record<SessionId, TrainingSession> = {
  "lower-a": {
    id: "lower-a",
    title: "Lower A",
    category: "Strength",
    duration: "58 min",
    load: 8,
    summary: "Quad strength, power, lower-leg resilience, and trunk control.",
    exercises: [
      { id: "pogo", name: "Pogo Hops", target: "3 x 20 touches", unit: "bodyweight", sets: 3, restSeconds: 45 },
      { id: "front-squat", name: "Front Squat", target: "3 x 5", defaultWeight: 100, unit: "lb", sets: 3, restSeconds: 150 },
      { id: "back-squat", name: "Back Squat", target: "3 x 5, fast reps", defaultWeight: 155, unit: "lb", sets: 3, restSeconds: 150 },
      { id: "bulgarian", name: "Bulgarian Split Squat", target: "3 x 8 each leg", defaultWeight: 50, unit: "lb", sets: 3, restSeconds: 90 },
      { id: "calf", name: "Single-Leg Calf Raise", target: "4 x 8 each leg", defaultWeight: 60, unit: "lb", sets: 4, restSeconds: 75 },
      { id: "tib", name: "Tibialis Raises", target: "3 x 15-20", unit: "bodyweight", sets: 3, restSeconds: 45 },
      {
        id: "core",
        name: "Core Pair",
        target: "3 rounds",
        sets: 3,
        restSeconds: 45,
        movements: [
          { id: "plank-pull", name: "DB Plank Pull-Through", reps: "8/side", defaultWeight: 20, unit: "lb" },
          { id: "leg-lower", name: "Straight-Leg Lowering", reps: "10", unit: "bodyweight" },
        ],
      },
    ],
  },
  "upper-a": {
    id: "upper-a",
    title: "Upper A",
    category: "Strength",
    duration: "52 min",
    load: 6,
    summary: "Chest growth, rowing strength, shoulder balance, and pull-up volume.",
    exercises: [
      {
        id: "pullup-warm",
        name: "Pull-Up + Push-Up Warm-Up",
        target: "2 rounds",
        sets: 2,
        restSeconds: 45,
        movements: [
          { id: "pullup", name: "Pull-Up", reps: "6", unit: "bodyweight" },
          { id: "pushup", name: "Push-Up", reps: "12", unit: "bodyweight" },
        ],
      },
      {
        id: "bench-row",
        name: "Bench + Row Superset",
        target: "3 rounds",
        sets: 3,
        restSeconds: 120,
        movements: [
          { id: "bench", name: "Barbell Bench Press", reps: "6-8", defaultWeight: 125, unit: "lb" },
          { id: "row", name: "Barbell Row", reps: "6-8", defaultWeight: 125, unit: "lb" },
        ],
      },
      {
        id: "incline-row",
        name: "Incline + Chest-Supported Row",
        target: "3 rounds",
        sets: 3,
        restSeconds: 90,
        movements: [
          { id: "incline", name: "Incline DB Press", reps: "8-10", defaultWeight: 45, unit: "lb" },
          { id: "chest-row", name: "Chest-Supported DB Row", reps: "8", defaultWeight: 45, unit: "lb" },
        ],
      },
      {
        id: "raises",
        name: "Rear Delt + Lateral Raises",
        target: "3 rounds",
        sets: 3,
        restSeconds: 45,
        movements: [
          { id: "rear-delt", name: "Rear Delt Raise", reps: "12-15", defaultWeight: 5, unit: "lb" },
          { id: "lateral", name: "Lateral Raise", reps: "12-15", defaultWeight: 5, unit: "lb" },
        ],
      },
      { id: "pushup", name: "Push-Up Finisher", target: "2 near-failure sets", unit: "bodyweight", sets: 2, restSeconds: 60 },
    ],
  },
  "lower-b": {
    id: "lower-b",
    title: "Lower B",
    category: "Strength",
    duration: "54 min",
    load: 7,
    summary: "Hamstrings, hips, lateral power, calves, and anti-extension core.",
    exercises: [
      { id: "bounds", name: "Lateral Bounds", target: "3 x 6 each side", unit: "bodyweight", sets: 3, restSeconds: 60 },
      { id: "rdl", name: "Romanian Deadlift", target: "4 x 8, 3-second lower", defaultWeight: 135, unit: "lb", sets: 4, restSeconds: 120 },
      { id: "hip-thrust", name: "Hip Thrust", target: "3 x 10", defaultWeight: 135, unit: "lb", sets: 3, restSeconds: 90 },
      { id: "single-rdl", name: "Single-Leg RDL", target: "3 x 8 each leg", defaultWeight: 35, unit: "lb", sets: 3, restSeconds: 75 },
      { id: "calf-volume", name: "Single-Leg Calf Raise", target: "3 x 15-20 each leg", defaultWeight: 45, unit: "lb", sets: 3, restSeconds: 60 },
      { id: "hanging", name: "Hanging Knee Raise", target: "3 x 12", unit: "bodyweight", sets: 3, restSeconds: 45 },
      { id: "rkc", name: "RKC Plank", target: "3 x 20 sec", unit: "time", sets: 3, restSeconds: 45 },
    ],
  },
  "upper-b": {
    id: "upper-b",
    title: "Upper B",
    category: "Strength",
    duration: "44 min",
    load: 5,
    summary: "Pull-up endurance, overhead strength, arm work, jump rope, and rotation.",
    exercises: [
      { id: "rope", name: "Weighted Jump Rope", target: "5 x 60 sec", unit: "time", sets: 5, restSeconds: 60 },
      { id: "pullups", name: "Pull-Up Progression", target: "4 x 5-8 strict", unit: "bodyweight", sets: 4, restSeconds: 120 },
      { id: "ohp", name: "Barbell Overhead Press", target: "3 x 6-8", defaultWeight: 80, unit: "lb", sets: 3, restSeconds: 90 },
      {
        id: "push-curl",
        name: "Push-Up + Curl Superset",
        target: "3 rounds",
        sets: 3,
        restSeconds: 75,
        movements: [
          { id: "pushup", name: "Push-Up", reps: "max", unit: "bodyweight" },
          { id: "curl", name: "DB Curl", reps: "8-10", defaultWeight: 20, unit: "lb" },
        ],
      },
      { id: "woodchop", name: "DB Woodchoppers", target: "3 x 10 each side", defaultWeight: 20, unit: "lb", sets: 3, restSeconds: 45 },
    ],
  },
  activation: {
    id: "activation",
    title: "Match Prep",
    category: "Match Prep",
    duration: "18 min",
    load: 2,
    summary: "Light movement only. Wake up the hips, ankles, core, and nervous system.",
    exercises: [
      { id: "walk", name: "Easy Walk", target: "5 min", unit: "time", sets: 1, restSeconds: 0 },
      { id: "mobility", name: "Hip + Ankle Mobility", target: "2 rounds", unit: "bodyweight", sets: 2, restSeconds: 30 },
      { id: "rope-light", name: "Light Jump Rope", target: "3 x 45 sec", unit: "time", sets: 3, restSeconds: 45 },
      { id: "primer", name: "Acceleration Primer", target: "3 x 5 sec quick feet", unit: "time", sets: 3, restSeconds: 60 },
    ],
  },
  "zone-2": {
    id: "zone-2",
    title: "Zone 2",
    category: "Recovery",
    duration: "30-40 min",
    load: 3,
    summary: "Easy aerobic work. You should be able to hold a conversation.",
    exercises: [
      { id: "easy-cardio", name: "Easy Bike, Jog, Row, or Walk", target: "30-40 min", unit: "time", sets: 1, restSeconds: 0 },
      { id: "breathing", name: "Downshift Breathing", target: "4 min", unit: "time", sets: 1, restSeconds: 0 },
    ],
  },
};

export const matchDaySession = {
  id: "match-day" as const,
  title: "Match Day",
  category: "Match Prep" as const,
  duration: "Game",
  load: 10,
  summary: "Compete today. Keep extra work to warm-up, cooldown, food, and hydration.",
};

export function getMovements(exercise: Exercise): Movement[] {
  return exercise.movements ?? [
    {
      id: exercise.id,
      name: exercise.name,
      reps: exercise.target.match(/\d+(?:-\d+)?|max/)?.[0] ?? "",
      defaultWeight: exercise.defaultWeight,
      unit: exercise.unit,
    },
  ];
}

export function getSessionVariant(sessionId: SessionId, variant: Variant): TrainingSession {
  const session = sessions[sessionId];
  if (variant === "full") return session;

  const customExercises = sessionVariants[sessionId]?.[variant];
  if (customExercises) {
    return {
      ...session,
      title: `${session.title} ${variant === "short" ? "Short" : "Primer"}`,
      duration: variant === "short" ? "28-35 min" : "12-20 min",
      load: variant === "short" ? Math.max(2, session.load - 2) : Math.min(3, session.load),
      summary: variant === "short"
        ? "Reduced-volume version for busy, sore, or compressed weeks."
        : "Lowest-fatigue version. Move well, keep the habit, and protect performance.",
      exercises: customExercises,
    };
  }

  if (variant === "primer") {
    return {
      ...session,
      title: `${session.title} Primer`,
      duration: "12-20 min",
      load: Math.min(3, session.load),
      summary: "Lowest-fatigue version. Move well, keep the habit, and protect performance.",
      exercises: session.exercises.slice(0, 3).map((exercise) => reduceExercise(exercise, 1)),
    };
  }

  return {
    ...session,
    title: `${session.title} Short`,
    duration: "28-35 min",
    load: Math.max(2, session.load - 2),
    summary: "Reduced-volume version for busy, sore, or compressed weeks.",
    exercises: session.exercises.slice(0, Math.min(5, session.exercises.length)).map((exercise) => reduceExercise(exercise, 2)),
  };
}

function reduceExercise(exercise: Exercise, maxSets: number): Exercise {
  const nextSets = Math.min(exercise.sets, maxSets);
  const target = /^\d+\s*x|^\d+\s*round/i.test(exercise.target)
    ? exercise.target.replace(/^\d+/, String(nextSets))
    : exercise.target;
  return {
    ...exercise,
    sets: nextSets,
    target,
  };
}

function exercise(sessionId: SessionId, exerciseId: string, sets?: number, target?: string): Exercise {
  const source = sessions[sessionId].exercises.find((item) => item.id === exerciseId);
  if (!source) throw new Error(`Missing exercise ${exerciseId}`);
  return sets ? { ...source, sets, target: target ?? source.target.replace(/^\d+/, String(sets)) } : source;
}

const sessionVariants: Partial<Record<SessionId, Partial<Record<Variant, Exercise[]>>>> = {
  "lower-a": {
    short: [
      exercise("lower-a", "pogo", 2, "2 x 20 touches"),
      exercise("lower-a", "front-squat", 2, "2 x 5"),
      exercise("lower-a", "back-squat", 2, "2 x 5, fast reps"),
      exercise("lower-a", "bulgarian", 2, "2 x 8 each leg"),
      exercise("lower-a", "calf", 2, "2 x 8 each leg"),
    ],
    primer: [
      exercise("lower-a", "pogo", 1, "1 x 20 touches"),
      exercise("lower-a", "front-squat", 1, "1 x 5, crisp reps"),
      exercise("lower-a", "calf", 1, "1 x 8 each leg"),
    ],
  },
  "upper-a": {
    short: [
      exercise("upper-a", "pullup-warm", 1, "1 round"),
      exercise("upper-a", "bench-row", 2, "2 rounds"),
      exercise("upper-a", "incline-row", 2, "2 rounds"),
      exercise("upper-a", "raises", 2, "2 rounds"),
    ],
    primer: [
      exercise("upper-a", "pullup-warm", 1, "1 round"),
      exercise("upper-a", "bench-row", 1, "1 round"),
      exercise("upper-a", "raises", 1, "1 round"),
    ],
  },
  "lower-b": {
    short: [
      exercise("lower-b", "bounds", 2, "2 x 6 each side"),
      exercise("lower-b", "rdl", 2, "2 x 8, 3-second lower"),
      exercise("lower-b", "single-rdl", 2, "2 x 8 each leg"),
      exercise("lower-b", "calf-volume", 2, "2 x 15-20 each leg"),
      exercise("lower-b", "rkc", 1, "1 x 20 sec"),
    ],
    primer: [
      exercise("lower-b", "bounds", 1, "1 x 6 each side"),
      exercise("lower-b", "single-rdl", 1, "1 x 8 each leg"),
      exercise("lower-b", "calf-volume", 1, "1 x 15 each leg"),
      exercise("lower-b", "rkc", 1, "1 x 20 sec"),
    ],
  },
  "upper-b": {
    short: [
      exercise("upper-b", "rope", 3, "3 x 60 sec"),
      exercise("upper-b", "pullups", 3, "3 x 5-8 strict"),
      exercise("upper-b", "ohp", 2, "2 x 6-8"),
      exercise("upper-b", "push-curl", 2, "2 rounds"),
      exercise("upper-b", "woodchop", 2, "2 x 10 each side"),
    ],
    primer: [
      exercise("upper-b", "rope", 2, "2 x 45 sec"),
      exercise("upper-b", "pullups", 2, "2 x 5 strict"),
      exercise("upper-b", "push-curl", 1, "1 round"),
    ],
  },
  activation: {
    short: [
      exercise("activation", "walk"),
      exercise("activation", "mobility", 1, "1 round"),
      exercise("activation", "rope-light", 2, "2 x 45 sec"),
    ],
    primer: [
      exercise("activation", "mobility", 1, "1 round"),
      exercise("activation", "primer", 2, "2 x 5 sec quick feet"),
    ],
  },
  "zone-2": {
    short: [
      exercise("zone-2", "easy-cardio", 1, "20-30 min"),
      exercise("zone-2", "breathing"),
    ],
    primer: [
      exercise("zone-2", "breathing"),
    ],
  },
};
