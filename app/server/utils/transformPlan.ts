type PlanRow = { plan_id: string; plan_name: string; active: boolean | string }
type PhaseRow = { phase_id: string; plan_id: string; phase_name: string; phase_order: number | string; weeks_count: number | string }
type WorkoutRow = { workout_id: string; phase_id: string; week_number: number | string; day_name: string; workout_order: number | string; focus: string }
type ExerciseRow = {
  exercise_id: string
  workout_id: string
  order: number | string
  name: string
  warmup_sets: number | string
  working_sets: number | string
  reps: string
  load?: string
  rpe: string
  rest: string
  sub1?: string
  sub2?: string
  notes?: string
  group?: string
}

export type NormalizedPlan = {
  plans: Array<{
    id: string
    name: string
    active: boolean
    phases: Array<{
      id: string
      name: string
      order: number
      weeksCount: number
      weeks: Array<{
        week: number
        workouts: Array<{
          id: string
          dayName: string
          order: number
          focus: string
          exercises: Array<{
            id: string
            order: number
            group?: string
            name: string
            warmupSets: string
            workingSets: string
            reps: string
            load: string
            rpe: string
            rest: string
            subs: string[]
            notes: string
          }>
        }>
      }>
    }>
  }>
}

type SheetData = {
  plans: PlanRow[]
  phases: PhaseRow[]
  workouts: WorkoutRow[]
  exercises: ExerciseRow[]
}

const toNumber = (value: number | string | undefined, fallback = 0) => {
  if (value === undefined || value === null) return fallback
  const num = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(num) ? num : fallback
}

const toBool = (value: boolean | string) => {
  if (typeof value === 'boolean') return value
  return String(value).toLowerCase() === 'true'
}

const cleanText = (value?: string) => (value ?? '').toString().trim()

export function transformPlan(data: SheetData): NormalizedPlan {
  const byPlan = data.plans.map((plan) => ({
    id: plan.plan_id,
    name: plan.plan_name,
    active: toBool(plan.active),
    phases: [] as NormalizedPlan['plans'][number]['phases']
  }))

  const phasesByPlan = data.phases.reduce<Record<string, PhaseRow[]>>((acc, phase) => {
    const key = phase.plan_id
    acc[key] = acc[key] || []
    acc[key].push(phase)
    return acc
  }, {})

  const workoutsByPhase = data.workouts.reduce<Record<string, WorkoutRow[]>>((acc, workout) => {
    const key = workout.phase_id
    acc[key] = acc[key] || []
    acc[key].push(workout)
    return acc
  }, {})

  const exercisesByWorkout = data.exercises.reduce<Record<string, ExerciseRow[]>>((acc, exercise) => {
    const key = exercise.workout_id
    acc[key] = acc[key] || []
    acc[key].push(exercise)
    return acc
  }, {})

  byPlan.forEach((plan) => {
    const phases = phasesByPlan[plan.id] || []
    plan.phases = phases
      .sort((a, b) => toNumber(a.phase_order) - toNumber(b.phase_order))
      .map((phase) => {
        const weeksMap = new Map<number, WorkoutRow[]>()
        const workouts = (workoutsByPhase[phase.phase_id] || []).sort(
          (a, b) => toNumber(a.workout_order) - toNumber(b.workout_order)
        )

        workouts.forEach((workout) => {
          const wk = toNumber(workout.week_number)
          if (!weeksMap.has(wk)) weeksMap.set(wk, [])
          weeksMap.get(wk)!.push(workout)
        })

        const weeks = Array.from(weeksMap.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([weekNumber, weekWorkouts]) => ({
            week: weekNumber,
            workouts: weekWorkouts.map((wk) => ({
              id: wk.workout_id,
              dayName: wk.day_name,
              order: toNumber(wk.workout_order),
              focus: wk.focus,
              exercises: (exercisesByWorkout[wk.workout_id] || [])
                .sort((a, b) => toNumber(a.order) - toNumber(b.order))
                .map((ex) => ({
                  id: ex.exercise_id,
                  order: toNumber(ex.order),
                  group: cleanText(ex.group),
                  name: ex.name,
                  warmupSets: cleanText(String(ex.warmup_sets)),
                  workingSets: cleanText(String(ex.working_sets)),
                  reps: cleanText(ex.reps),
                  load: cleanText(ex.load),
                  rpe: cleanText(ex.rpe),
                  rest: cleanText(ex.rest),
                  subs: [cleanText(ex.sub1), cleanText(ex.sub2)].filter(Boolean),
                  notes: cleanText(ex.notes)
                }))
            }))
          }))

        return {
          id: phase.phase_id,
          name: phase.phase_name,
          order: toNumber(phase.phase_order),
          weeksCount: toNumber(phase.weeks_count),
          weeks
        }
      })
  })

  return { plans: byPlan }
}
