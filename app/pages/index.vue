<script setup lang="ts">
definePageMeta({ ssr: false })

const planStore = usePlanStore()
const progressStore = useProgressStore()
const viewStore = useViewStore()
const weightsStore = useWeightsStore()

import type { NormalizedPlan } from '~/server/utils/transformPlan'

type WorkoutItem = NormalizedPlan['plans'][number]['phases'][number]['weeks'][number]['workouts'][number]
type ExerciseItem = WorkoutItem['exercises'][number]

const currentPlan = computed(() => planStore.activePlan)

const phaseOptions = computed(() =>
  (currentPlan.value?.phases || []).map(phase => ({
    label: phase.name,
    value: phase.id
  }))
)
const phases = computed(() => currentPlan.value?.phases || [])
const orderedPhases = computed(() =>
  [...phases.value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
)

const selectedPhaseId = useState<string | null>('selectedPhaseId', () => null)

const phaseHasRemaining = (phaseId: string) => {
  const phase = phases.value.find(p => p.id === phaseId)
  if (!phase) return false
  return phase.weeks.some(week =>
    week.workouts.some(w => !progressStore.isCompleted(phaseId, week.week, w.id))
  )
}

const pickInitialPhase = () => {
  if (!phases.value.length) {
    selectedPhaseId.value = null
    return
  }
  if (selectedPhaseId.value && phases.value.some(p => p.id === selectedPhaseId.value)) {
    return
  }
  const firstWithWork = phases.value.find(p => phaseHasRemaining(p.id))
  selectedPhaseId.value = firstWithWork?.id ?? phases.value[0]!.id
}

watch(
  () => phaseOptions.value,
  () => pickInitialPhase(),
  { immediate: true }
)

const currentPhase = computed(() => {
  if (!orderedPhases.value.length) return null
  return orderedPhases.value.find(p => p.id === selectedPhaseId.value) || orderedPhases.value[0]
})

onMounted(async () => {
  // Ensure data is loaded even if store onMounted didn't run (SSR/hydration edge)
  if (!planStore.plans.length) {
    await planStore.load()
  }
  if (import.meta.client) {
    console.info('[plan] phases', currentPlan.value?.phases?.length || 0, 'weeks', currentPhase.value?.weeks?.length || 0)
  }
})

const weekOptions = computed(() =>
  (currentPhase.value?.weeks || []).map(week => ({
    label: `Week ${week.week}`,
    value: week.week
  }))
)
const weeks = computed(() => currentPhase.value?.weeks || [])

const selectedWeek = useState<number | null>('selectedWeek', () => null)

const weekHasRemaining = (phaseId: string, weekNumber: number) => {
  const phase = phases.value.find(p => p.id === phaseId)
  const week = phase?.weeks.find(w => w.week === weekNumber)
  if (!week) return false
  return week.workouts.some(w => !progressStore.isCompleted(phaseId, weekNumber, w.id))
}

const pickInitialWeek = () => {
  const weeks = weekOptions.value
  if (!weeks.length) {
    selectedWeek.value = null
    return
  }
  const phaseId = currentPhase.value?.id
  if (!phaseId) {
    selectedWeek.value = weeks[0]!.value
    return
  }
  if (selectedWeek.value && currentPhase.value?.weeks.some(week => week.week === selectedWeek.value)) {
    return
  }
  const firstWithWorkLeft = currentPhase.value?.weeks.find(week =>
    week.workouts.some(w => !progressStore.isCompleted(phaseId, week.week, w.id))
  )
  selectedWeek.value = (firstWithWorkLeft?.week ?? weeks[0]!.value)
}

watch(
  () => [weekOptions.value, selectedPhaseId.value, planStore.plans.length],
  () => pickInitialWeek(),
  { immediate: true }
)

const appliedViewState = ref(false)

const applyViewState = () => {
  if (appliedViewState.value) return
  if (!viewStore.hydrated) return
  if (!phases.value.length) return
  const storedPhaseId = viewStore.viewState.phaseId
  let applied = false
  if (storedPhaseId && phases.value.some(p => p.id === storedPhaseId)) {
    selectedPhaseId.value = storedPhaseId
    applied = true
  }
  const phase = phases.value.find(p => p.id === (storedPhaseId ?? selectedPhaseId.value))
  const storedWeek = viewStore.viewState.week
  if (storedWeek && phase?.weeks.some(week => week.week === storedWeek)) {
    selectedWeek.value = storedWeek
    applied = true
  }
  if (applied) appliedViewState.value = true
}

watch(
  () => [phases.value.length, viewStore.viewState.phaseId, viewStore.viewState.week],
  () => applyViewState(),
  { immediate: true }
)

watch(
  () => viewStore.remoteViewStateLoaded,
  (loaded) => {
    if (loaded) {
      appliedViewState.value = false
      applyViewState()
    }
  }
)

const appliedLastCompletion = ref(false)

const applyLastCompletion = () => {
  if (appliedLastCompletion.value) return
  if (!phases.value.length) return

  let bestTs = ''
  let bestPhaseId = ''
  let bestWeek = 0

  const scan = (map: Record<string, { completedAt?: string, skippedAt?: string }>) => {
    for (const [key, val] of Object.entries(map)) {
      const ts = val.completedAt ?? val.skippedAt ?? ''
      if (!ts || ts <= bestTs) continue
      const parts = key.split(':')
      if (parts.length < 2) continue
      const phaseId = parts[0] ?? ''
      const week = Number(parts[1] ?? '')
      if (!Number.isFinite(week) || week <= 0) continue
      if (!phases.value.some(p => p.id === phaseId)) continue
      bestTs = ts
      bestPhaseId = phaseId
      bestWeek = week
    }
  }

  scan(progressStore.completions)
  scan(progressStore.exerciseCompletions)
  scan(progressStore.skipCompletions)

  if (!bestPhaseId || !bestWeek) return

  selectedPhaseId.value = bestPhaseId
  appliedLastCompletion.value = true
}

watch(
  () => [
    Object.keys(progressStore.completions).length + Object.keys(progressStore.exerciseCompletions).length,
    phases.value.length
  ],
  () => { if (!appliedLastCompletion.value) applyLastCompletion() },
  { immediate: true }
)

watch(
  () => selectedPhaseId.value,
  (phaseId) => {
    viewStore.update({ phaseId: phaseId ?? null })
  }
)

watch(
  () => selectedWeek.value,
  (week) => {
    viewStore.update({ week: week ?? null })
  }
)

const weekData = computed(() =>
  currentPhase.value?.weeks.find(week => week.week === selectedWeek.value) || null
)

const nextWorkout = computed(() => {
  const phaseId = currentPhase.value?.id
  if (!phaseId || !weekData.value) return null
  const notDone = weekData.value.workouts.find(w => !progressStore.isCompleted(phaseId, weekData.value!.week, w.id))
  return notDone || weekData.value.workouts[0] || null
})

const todayKey = () => new Date().toISOString().slice(0, 10)
const blockedForToday = computed(() => progressStore.lastWorkoutDate === todayKey())

const selectedWorkoutId = ref<string | null>(null)

const currentWorkout = computed(() => {
  const workouts = weekData.value?.workouts || []
  if (selectedWorkoutId.value) {
    return workouts.find(w => w.id === selectedWorkoutId.value) ?? nextWorkout.value
  }
  return nextWorkout.value
})

watch(
  () => selectedWeek.value,
  () => { selectedWorkoutId.value = null }
)

watch(
  () => currentWorkout.value?.id,
  (workoutId) => {
    viewStore.update({ workoutId: workoutId ?? null })
  }
)

const cycleOrder = ['Legs', 'Push', 'Pull', 'Rest', 'Full', 'Rest']

const upcomingWorkout = computed(() => {
  const phaseId = currentPhase.value?.id
  if (!phaseId || !weekData.value || !currentWorkout.value) return null

  const focus = currentWorkout.value.focus
  const idx = cycleOrder.findIndex(f => f.toLowerCase() === focus.toLowerCase())
  const nextFocus = idx === -1 ? null : cycleOrder[(idx + 1) % cycleOrder.length]

  const remaining = weekData.value.workouts.filter(w => !progressStore.isCompleted(phaseId, weekData.value!.week, w.id))
  const nextIndex = remaining.findIndex(w => w.id === currentWorkout.value?.id)
  const afterCurrent = nextIndex === -1 ? null : remaining[nextIndex + 1]

  if (nextFocus === 'Rest') {
    return {
      id: 'rest-day',
      dayName: 'Rest',
      focus: 'Rest',
      exercises: []
    }
  }

  if (nextFocus) {
    const matchByFocus = remaining.find(w => w.focus.toLowerCase() === nextFocus.toLowerCase() && w.id !== currentWorkout.value?.id)
    if (matchByFocus) return matchByFocus
  }

  return afterCurrent || remaining.find(w => w.id !== currentWorkout.value?.id) || null
})

const visibleWorkouts = computed(() => {
  if (blockedForToday.value) return []
  if (!currentWorkout.value) return []
  return [currentWorkout.value]
})

const completedToday = computed(() => {
  const phaseId = currentPhase.value?.id
  if (!phaseId || !weekData.value) return null
  return weekData.value.workouts.find(w => progressStore.isCompleted(phaseId, weekData.value!.week, w.id)) || null
})

const reopenToday = () => {
  if (!blockedForToday.value) return
  const phaseId = currentPhase.value?.id
  if (phaseId && weekData.value && completedToday.value) {
    progressStore.toggleCompletion(phaseId, weekData.value.week, completedToday.value.id)
  }
  progressStore.lastWorkoutDate = null
}

const unlockNextToday = () => {
  // Allow starting another workout the same calendar day without clearing completion
  progressStore.lastWorkoutDate = null
}

const rpeColor = (rpe: string) => {
  const num = Number(String(rpe).replace(/[^0-9.]/g, ''))
  if (Number.isNaN(num)) return 'neutral'
  if (num >= 9.5) return 'error'
  if (num >= 8) return 'warning'
  return 'neutral'
}

const advanceIfCompleted = () => {
  const phaseId = currentPhase.value?.id
  const weekNumber = weekData.value?.week
  if (!phaseId || !weekNumber) return
  if (weekHasRemaining(phaseId, weekNumber)) return

  const ordered = orderedPhases.value
  const currentPhaseIdx = ordered.findIndex(p => p.id === phaseId)
  const phase = ordered[currentPhaseIdx]

  // Next remaining week in the same phase by order
  const nextWeek = phase?.weeks
    ?.filter(w => w.week > weekNumber)
    .find(w => weekHasRemaining(phaseId, w.week))
  if (nextWeek) {
    selectedWeek.value = nextWeek.week
    return
  }

  // Move to next phase in sequence (wrap)
  if (!ordered.length) return
  const nextPhaseIdx = (currentPhaseIdx + 1) % ordered.length
  const wrapped = nextPhaseIdx === 0 && currentPhaseIdx === ordered.length - 1

  if (wrapped) {
    // Completed all phases/weeks: reset and clear progress
    progressStore.clear()
    viewStore.clear()
    selectedPhaseId.value = ordered[0]!.id
    selectedWeek.value = ordered[0]!.weeks[0]?.week ?? null
    return
  }

  selectedPhaseId.value = ordered[nextPhaseIdx]!.id
  pickInitialWeek()
}

const isMainCompleted = (workoutId: string, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return false
  return progressStore.isExerciseCompleted(phaseId, week, workoutId, exerciseId)
}

const isSkippedExercise = (workoutId: string, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return false
  return progressStore.isSkipped(phaseId, week, workoutId, exerciseId)
}

const isExerciseDone = (workout: WorkoutItem, exercise: ExerciseItem) => {
  if (isSkippedExercise(workout.id, exercise.id)) return true
  return isMainCompleted(workout.id, exercise.id)
}

const nextIncompleteSegment = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return null

  for (const exercise of workout.exercises) {
    if (isSkippedExercise(workout.id, exercise.id)) continue
    if (!isMainCompleted(workout.id, exercise.id)) {
      return { exercise, stage: 'main' as const }
    }
  }
  return null
}

const activeExerciseId = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return null
  const firstIncomplete = workout.exercises.find(ex => !isExerciseDone(workout, ex))
  return firstIncomplete?.id || null
}

const isActiveExercise = (workout: WorkoutItem, exerciseId: string) => {
  return activeExerciseId(workout) === exerciseId
}

const openExercises = ref<Record<string, boolean>>({})
const stickyExerciseRef = ref<{ workoutId: string, exerciseId: string } | null>(null)
const detailKey = (workoutId: string, exerciseId: string) => `${workoutId}:${exerciseId}`

const isDetailsOpen = (workout: WorkoutItem, exerciseId: string) => {
  const exercise = workout.exercises.find(ex => ex.id === exerciseId)
  if (exercise && isExerciseDone(workout, exercise)) return false
  const key = detailKey(workout.id, exerciseId)
  const explicit = openExercises.value[key]
  if (typeof explicit === 'boolean') return explicit
  if (isActiveExercise(workout, exerciseId)) return true
  return false
}

const toggleDetails = (workout: WorkoutItem, exerciseId: string) => {
  const exercise = workout.exercises.find(ex => ex.id === exerciseId)
  const key = detailKey(workout.id, exerciseId)
  const nextState = !openExercises.value[key]
  openExercises.value[key] = nextState
  if (nextState && exercise && !isExerciseDone(workout, exercise)) {
    stickyExerciseRef.value = { workoutId: workout.id, exerciseId }
  }
}

const setOpenForExercise = (workoutId: string, exerciseId: string, open: boolean) => {
  openExercises.value[detailKey(workoutId, exerciseId)] = open
  const workout = currentWorkout.value
  const exercise = workout?.exercises.find(ex => ex.id === exerciseId)
  if (open && workout && exercise && !isExerciseDone(workout, exercise)) {
    stickyExerciseRef.value = { workoutId, exerciseId }
  }
}

const openNextActive = (workout: WorkoutItem) => {
  const nextId = activeExerciseId(workout)
  if (nextId) {
    setOpenForExercise(workout.id, nextId, true)
    stickyExerciseRef.value = { workoutId: workout.id, exerciseId: nextId }
  }
}

const handleExerciseToggle = (workout: WorkoutItem, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  const wasCompleted = progressStore.isExerciseCompleted(phaseId, week, workout.id, exerciseId)
  progressStore.toggleExercise(phaseId, week, workout.id, exerciseId)
  if (!wasCompleted) {
    const exercise = workout.exercises.find(ex => ex.id === exerciseId)
    if (exercise && allowWeightEntryFor(exercise)) {
      weightsStore.commitCurrentAsLast(effectiveWeightKeyFor(phaseId, exercise))
      weightsStore.clearCurrentWeight(effectiveWeightKeyFor(phaseId, exercise))
    }
  }
  setOpenForExercise(workout.id, exerciseId, false)
  openNextActive(workout)
  syncWorkoutCompletion(workout)
}

const handleSkipExercise = (workout: WorkoutItem, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  progressStore.toggleSkip(phaseId, week, workout.id, exerciseId)
  setOpenForExercise(workout.id, exerciseId, false)
  openNextActive(workout)
  syncWorkoutCompletion(workout)
}

const finishDay = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  for (const exercise of workout.exercises) {
    if (!isExerciseDone(workout, exercise)) {
      progressStore.toggleSkip(phaseId, week, workout.id, exercise.id)
    }
  }
  syncWorkoutCompletion(workout)
}

const completionPatternStyle = {
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 6px, transparent 6px, transparent 12px)',
  backgroundSize: '10px 10px'
}

const rowCompletionStyle = (done: boolean) => done ? completionPatternStyle : {}

const setBorderClass = (done: boolean) => done ? 'border-2 border-solid border-l-4 border-muted' : 'border-2 border-dashed border-muted/60'

const isLinkedBelow = (workout: WorkoutItem, idx: number) => {
  const current = workout.exercises[idx]
  const next = workout.exercises[idx + 1]
  if (!current?.group || !next?.group) return false
  return current.group === next.group
}

const stickyTarget = computed(() => {
  const workout = currentWorkout.value
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week || !workout) return null
  if (!visibleWorkouts.value.length) return null
  if (progressStore.isCompleted(phaseId, week, workout.id)) return null

  const segment = nextIncompleteSegment(workout)
  if (!segment) return null

  return {
    workoutId: workout.id,
    exercise: segment.exercise,
    stage: segment.stage
  }
})

const restoreExerciseFocus = () => {
  const workout = currentWorkout.value
  if (!workout) return
  const storedWorkoutId = viewStore.viewState.workoutId
  const storedExerciseId = viewStore.viewState.exerciseId
  if (!storedWorkoutId || !storedExerciseId) return
  if (storedWorkoutId !== workout.id) return
  const exercise = workout.exercises.find(ex => ex.id === storedExerciseId)
  if (!exercise || isExerciseDone(workout, exercise)) return
  setOpenForExercise(workout.id, exercise.id, true)
  stickyExerciseRef.value = { workoutId: workout.id, exerciseId: exercise.id }
}

watch(
  () => [currentWorkout.value?.id, selectedWeek.value, selectedPhaseId.value],
  () => {
    const workout = currentWorkout.value
    if (!workout) {
      stickyExerciseRef.value = null
      return
    }
    const storedExerciseId = viewStore.viewState.exerciseId
    if (storedExerciseId) {
      const exercise = workout.exercises.find(ex => ex.id === storedExerciseId)
      if (exercise && !isExerciseDone(workout, exercise)) {
        setOpenForExercise(workout.id, exercise.id, true)
        stickyExerciseRef.value = { workoutId: workout.id, exerciseId: exercise.id }
        return
      }
    }
    const nextId = activeExerciseId(workout)
    stickyExerciseRef.value = nextId ? { workoutId: workout.id, exerciseId: nextId } : null
  },
  { immediate: true }
)

watch(
  () => stickyExerciseRef.value?.exerciseId,
  (exerciseId) => {
    viewStore.update({ exerciseId: exerciseId ?? null })
  }
)

watch(
  () => [currentWorkout.value?.id, viewStore.viewState.exerciseId],
  () => restoreExerciseFocus(),
  { immediate: true }
)

const markStickyDone = () => {
  if (!stickyTarget.value || !currentWorkout.value) return
  handleExerciseToggle(currentWorkout.value, stickyTarget.value.exercise.id)
}

const markStickySkipped = () => {
  if (!stickyTarget.value || !currentWorkout.value) return
  handleSkipExercise(currentWorkout.value, stickyTarget.value.exercise.id)
}

const workoutCompletionParts = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  let total = 0
  let completed = 0

  workout.exercises.forEach((exercise) => {
    total += 1
    if (phaseId && week) {
      if (isSkippedExercise(workout.id, exercise.id)) {
        completed += 1
        return
      }
      if (isMainCompleted(workout.id, exercise.id)) completed += 1
    }
  })

  return { completed, total: total || 1 }
}

const workoutFullyDone = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return false
  return workout.exercises.every(ex => isExerciseDone(workout, ex))
}

const syncWorkoutCompletion = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  const shouldBeDone = workoutFullyDone(workout)
  const isDone = progressStore.isCompleted(phaseId, week, workout.id)
  if (shouldBeDone !== isDone) {
    progressStore.toggleCompletion(phaseId, week, workout.id)
    if (shouldBeDone) {
      advanceIfCompleted()
    }
  }
}

function toNumber(input: string) {
  const match = String(input || '').match(/(\d+(\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

const parseRepRange = (input: string) => {
  const matches = String(input || '').match(/(\d+(\.\d+)?)/g)
  if (!matches || !matches.length) return { min: 0, max: 0 }
  if (matches.length === 1) {
    const val = Number(matches[0])
    return { min: val, max: val }
  }
  return { min: Number(matches[0]), max: Number(matches[1]) }
}

const normalizeKey = (input: string) =>
  String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const isFeederSet = (exercise: ExerciseItem) =>
  /feeder\s*sets?/i.test(exercise.name || '')

const isTimeBased = (exercise: ExerciseItem) =>
  /(\d+)\s*(s|sec|secs|seconds)\b/i.test(exercise.reps || '') || /hold/i.test(exercise.reps || '')

const isBodyweightAmrap = (exercise: ExerciseItem) => {
  if (!/amrap/i.test(exercise.reps || '')) return false
  return /(push\s*-?\s*up|pull\s*-?\s*up|chin\s*-?\s*up|dip)/i.test(exercise.name || '')
}

const allowWeightEntryFor = (exercise: ExerciseItem) => {
  if (isFeederSet(exercise)) return false
  if (isTimeBased(exercise)) return false
  if (isBodyweightAmrap(exercise)) return false
  return true
}

const weightKeyFor = (phaseId: string, exercise: ExerciseItem) =>
  `${phaseId}:${normalizeKey(exercise.name)}:${normalizeKey(exercise.reps)}:${normalizeKey(exercise.workingSets)}`

const lastWeightFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  return weightsStore.getLastWeight(effectiveWeightKeyFor(phaseId, exercise))
}

const currentWeightFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  return weightsStore.getCurrentWeight(effectiveWeightKeyFor(phaseId, exercise))
}

const warmupBaseWeightFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  return weightsStore.getWarmupBaseWeight(effectiveWeightKeyFor(phaseId, exercise))
}

const formatWeight = (value: number) => {
  const rounded = Math.round(value * 2) / 2
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}

const workingWeightDisplayFor = (exercise: ExerciseItem) => {
  const weight = currentWeightFor(exercise)
  return weight === null ? '' : formatWeight(weight)
}

const workingWeightPlaceholderFor = (exercise: ExerciseItem) => {
  const weight = lastWeightFor(exercise)
  return weight ? `${formatWeight(weight)} kg` : 'Enter'
}

const updateWorkingWeight = (exercise: ExerciseItem, value: string | number) => {
  const phaseId = currentPhase.value?.id
  if (!phaseId) return
  const raw = typeof value === 'number' ? value : Number(String(value || '').replace(',', '.'))
  if (!Number.isFinite(raw) || raw <= 0) {
    weightsStore.clearCurrentWeight(effectiveWeightKeyFor(phaseId, exercise))
    return
  }
  weightsStore.setCurrentWeight(effectiveWeightKeyFor(phaseId, exercise), raw)
}

const currentPhaseNumber = computed(() => {
  const phase = currentPhase.value
  if (!phase) return null
  const orderValue = Number(phase.order)
  if (Number.isFinite(orderValue) && orderValue > 0) return orderValue
  const idx = orderedPhases.value.findIndex(p => p.id === phase.id)
  return idx >= 0 ? idx + 1 : null
})

const warmupPlanFor = (exercise: ExerciseItem) => {
  const warmupSets = Math.round(toNumber(exercise.warmupSets))
  if (!warmupSets) return []
  if (!allowWeightEntryFor(exercise)) return []
  const phaseNumber = currentPhaseNumber.value
  const reps = parseRepRange(exercise.reps)
  const isPhase3HighReps = phaseNumber === 3 && reps.max >= 15

  const r1 = reps.min
  const r2 = Math.max(1, Math.round(reps.min * 0.7))
  const r3 = Math.max(1, Math.round(reps.min * 0.5))

  if (isPhase3HighReps) {
    if (warmupSets <= 1) {
      return [{ percentRange: [0.5, 0.7], reps: `${r1} reps` }]
    }
    return [
      { percent: 0.5, reps: `${r1} reps` },
      { percent: 0.7, reps: `${r2} reps` }
    ]
  }

  if (warmupSets === 1) {
    return [{ percent: 0.6, reps: `${r1} reps` }]
  }
  if (warmupSets === 2) {
    return [
      { percent: 0.5, reps: `${r1} reps` },
      { percent: 0.7, reps: `${r2} reps` }
    ]
  }
  return [
    { percent: 0.45, reps: `${r1} reps` },
    { percent: 0.65, reps: `${r2} reps` },
    { percent: 0.85, reps: `${r3} reps` }
  ]
}

const warmupSummaryFor = (exercise: ExerciseItem) => {
  const baseWeight = warmupBaseWeightFor(exercise)
  if (!baseWeight) return []
  if (!allowWeightEntryFor(exercise)) return []
  const plan = warmupPlanFor(exercise)
  return plan.map((step, idx) => {
    if ('percentRange' in step) {
      const [minPct, maxPct] = step.percentRange
      const minWeight = formatWeight(baseWeight * minPct)
      const maxWeight = formatWeight(baseWeight * maxPct)
      return `Set ${idx + 1}: ${Math.round(minPct * 100)}–${Math.round(maxPct * 100)}% (~${minWeight}–${maxWeight} kg) · ${step.reps}`
    }
    const weight = formatWeight(baseWeight * step.percent)
    return `Set ${idx + 1}: ${Math.round(step.percent * 100)}% (~${weight} kg) · ${step.reps}`
  })
}

const feederSetNotes = [
  'Do 4 feeder sets of 10 reps, building weight each set.',
  'Set 1 RPE 4–5, Set 2 RPE 6–7, Set 3 RPE 7–8, Set 4 to failure at ~10 reps.',
  'After failure, drop weight ~30–50% and do 5 more reps (controlled).'
]

const feedbackLabelFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  const hint = weightsStore.getFeedback(effectiveWeightKeyFor(phaseId, exercise))
  if (!hint) return null
  if (hint === 'up') return 'Too light last time — increase'
  if (hint === 'down') return 'Too heavy last time — decrease'
  return 'Just right last time — keep'
}

const setFeedbackFor = (exercise: ExerciseItem, hint: 'up' | 'down' | 'hold') => {
  const phaseId = currentPhase.value?.id
  if (!phaseId) return
  weightsStore.setFeedback(effectiveWeightKeyFor(phaseId, exercise), hint)
}

const cleanSubs = (subs?: { name: string, link?: string }[]) => {
  return (subs || []).filter((sub) => {
    const name = (sub?.name || '').trim().toLowerCase()
    return name && name !== 'n/a'
  })
}

const effectiveNameFor = (exercise: ExerciseItem): string => {
  const idx = viewStore.viewState.exerciseVariants?.[exercise.id] ?? 0
  if (idx > 0) {
    const sub = cleanSubs(exercise.subs)[idx - 1]
    if (sub) return sub.name
  }
  return exercise.name
}

const effectiveLinkFor = (exercise: ExerciseItem): string => {
  const idx = viewStore.viewState.exerciseVariants?.[exercise.id] ?? 0
  if (idx > 0) {
    const sub = cleanSubs(exercise.subs)[idx - 1]
    if (sub?.link) return sub.link
    return ''
  }
  return exercise.link ?? ''
}

const effectiveWeightKeyFor = (phaseId: string, exercise: ExerciseItem) =>
  `${phaseId}:${normalizeKey(effectiveNameFor(exercise))}:${normalizeKey(exercise.reps)}:${normalizeKey(exercise.workingSets)}`

const settingsOpen = useState('settingsOpen', () => false)
</script>

<template>
  <UContainer
    class="space-y-6 py-6"
    :class="{ 'pb-24': Boolean(stickyTarget) }"
  >
    <transition name="fade">
      <div
        v-if="settingsOpen"
        class="fixed right-4 top-20 z-50 w-72 rounded-lg border border-muted/60 bg-white p-4 shadow-lg dark:bg-gray-900"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-semibold">
              Jump to phase/week
            </p>
            <p class="text-xs text-muted">
              Pick where you are in the plan.
            </p>
          </div>
          <UButton
            variant="ghost"
            size="2xs"
            icon="i-lucide-x"
            @click="settingsOpen = false"
          />
        </div>
        <div class="mt-3 space-y-2">
          <p class="text-xs uppercase tracking-wide text-muted">
            Phase
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="phase in phases"
              :key="phase.id"
              size="xs"
              :color="phase.id === selectedPhaseId ? 'primary' : 'neutral'"
              :variant="phase.id === selectedPhaseId ? 'soft' : 'ghost'"
              @click="() => { selectedPhaseId = phase.id; selectedWeek = phases.find(p => p.id === phase.id)?.weeks[0]?.week ?? null; settingsOpen = false }"
            >
              {{ phase.name }}
            </UButton>
          </div>
        </div>
        <div class="mt-3 space-y-2">
          <p class="text-xs uppercase tracking-wide text-muted">
            Week
          </p>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="week in weeks"
              :key="week.week"
              class="flex items-center"
            >
              <UButton
                size="xs"
                :color="week.week === selectedWeek ? 'primary' : 'neutral'"
                :variant="week.week === selectedWeek ? 'soft' : 'ghost'"
                class="rounded-r-none"
                @click="() => { selectedWeek = week.week; settingsOpen = false }"
              >
                Week {{ week.week }}
              </UButton>
              <UTooltip text="Repeat this week">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-rotate-ccw"
                  class="rounded-l-none border-l border-muted/30"
                  @click="() => { progressStore.clearWeek(currentPhase.id, week.week); selectedWeek = week.week; settingsOpen = false }"
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <div
      v-if="planStore.error"
      class="rounded-lg border border-amber-400/60 bg-amber-50/60 px-4 py-3 text-amber-900 dark:border-amber-300/60 dark:bg-amber-900/20 dark:text-amber-100"
    >
      {{ planStore.error }}
    </div>

    <div
      v-if="currentPhase && selectedWeek && currentPlan"
      class="inline-flex divide-x divide-muted/60 overflow-hidden rounded-lg border border-muted/60 text-sm"
    >
      <div class="px-3 py-2">
        <p class="font-semibold">
          {{ currentPhase.name }}
        </p>
      </div>
      <div class="px-3 py-2">
        <p class="font-semibold">
          Week {{ selectedWeek }}<span v-if="weeks.length">/{{ weeks.length }}</span>
        </p>
      </div>
      <div class="px-3 py-2">
        <p class="font-semibold">
          {{ currentPlan.name }}
        </p>
      </div>
    </div>

    <div
      v-if="planStore.loading"
      class="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <USkeleton
        v-for="n in 4"
        :key="n"
        class="h-32"
      />
    </div>

    <div
      v-else-if="!visibleWorkouts.length"
      class="rounded-lg border border-dashed border-muted/60 px-4 py-6 text-muted"
    >
      <template v-if="blockedForToday">
        Good job! Today's workout is done. Next one unlocks tomorrow.
        <div class="pt-3">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="reopenToday"
          >
            Reopen today&apos;s workout
          </UButton>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            class="ml-2"
            @click="unlockNextToday"
          >
            Start another today
          </UButton>
        </div>
      </template>
      <template v-else>
        No workouts found for this week.
      </template>
    </div>

    <div
      v-else
      class="flex flex-col gap-4"
    >
      <UCard
        v-for="workout in visibleWorkouts"
        :key="workout.id"
        class="flex flex-col gap-3"
      >
        <div class="flex items-center gap-3">
          <div class="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              class="h-full rounded-full bg-primary/70 transition-all"
              :style="(() => {
                const p = workoutCompletionParts(workout)
                return { width: `${Math.round((p.completed / p.total) * 100)}%` }
              })()"
            />
          </div>
          <span class="text-xs text-muted">
            {{
              (() => {
                const p = workoutCompletionParts(workout)
                return `${p.completed}/${p.total} done`
              })()
            }}
          </span>
        </div>

        <div class="space-y-2">
          <div class="flex flex-wrap gap-1">
            <UButton
              v-for="w in weekData?.workouts"
              :key="w.id"
              size="2xs"
              :color="w.id === workout.id ? 'primary' : progressStore.isCompleted(currentPhase!.id, weekData!.week, w.id) ? 'success' : 'neutral'"
              :variant="w.id === workout.id ? 'solid' : progressStore.isCompleted(currentPhase!.id, weekData!.week, w.id) ? 'soft' : 'ghost'"
              @click="selectedWorkoutId = w.id"
            >
              {{ w.focus }}
            </UButton>
          </div>
          <h2 class="text-xl font-semibold">
            {{ workout.focus }}
          </h2>
        </div>

        <div class="space-y-2">
          <div
            v-for="(exercise, idx) in workout.exercises"
            :key="exercise.id"
            class="rounded-lg border border-muted/50 bg-muted/5 px-3 py-2 transition-all"
            :class="isSkippedExercise(workout.id, exercise.id) ? 'opacity-60 line-through border-yellow-500/40 bg-yellow-500/5' : isExerciseDone(workout, exercise) ? 'opacity-60 line-through border-primary/40 bg-primary/5' : ''"
          >
            <div class="flex flex-wrap items-start gap-2">
              <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <UTooltip :text="isExerciseDone(workout, exercise) ? 'Completed' : 'Mark done'">
                  <UButton
                    size="2xs"
                    variant="ghost"
                    :color="isExerciseDone(workout, exercise) ? 'primary' : 'neutral'"
                    :icon="isExerciseDone(workout, exercise) ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-check-circle'"
                    @click="handleExerciseToggle(workout, exercise.id)"
                  />
                </UTooltip>
                <span
                  v-if="!effectiveLinkFor(exercise)"
                  class="text-sm font-medium"
                >
                  {{ effectiveNameFor(exercise) }}
                </span>
                <a
                  v-else
                  class="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  :href="effectiveLinkFor(exercise)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ effectiveNameFor(exercise) }}
                </a>
                <span
                  v-if="isDetailsOpen(workout, exercise.id)"
                  class="text-xs text-muted"
                >
                  <template v-if="isLinkedBelow(workout, idx)">
                    No rest to next
                  </template>
                  <template v-else>
                    Rest {{ exercise.rest }}
                  </template>
                </span>
                <UButton
                  v-if="cleanSubs(exercise.subs).length"
                  size="2xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-refresh-cw"
                  @click.stop="viewStore.cycleExerciseVariant(exercise.id, cleanSubs(exercise.subs).length + 1)"
                />
              </div>
              <div class="flex items-center gap-2">
                <UBadge
                  :color="rpeColor(exercise.rpe)"
                  variant="outline"
                >
                  RPE {{ exercise.rpe }}
                </UBadge>
                <UTooltip :text="isSkippedExercise(workout.id, exercise.id) ? 'Unskip' : 'Skip'">
                  <UButton
                    v-if="!isMainCompleted(workout.id, exercise.id)"
                    size="2xs"
                    variant="ghost"
                    :color="isSkippedExercise(workout.id, exercise.id) ? 'warning' : 'neutral'"
                    icon="i-lucide-skip-forward"
                    @click="handleSkipExercise(workout, exercise.id)"
                  />
                </UTooltip>
                <UButton
                  size="2xs"
                  variant="ghost"
                  :icon="isDetailsOpen(workout, exercise.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  @click="() => toggleDetails(workout, exercise.id)"
                />
              </div>
            </div>
            <div
              v-if="isDetailsOpen(workout, exercise.id)"
              class="mt-2 space-y-2"
            >
              <p
                v-if="exercise.notes"
                class="text-xs text-muted"
              >
                {{ exercise.notes }}
              </p>
              <div
                v-if="allowWeightEntryFor(exercise)"
                class="flex flex-wrap items-center gap-2 rounded-lg border border-muted/40 bg-white/60 px-3 py-2 text-xs dark:bg-gray-900/40"
              >
                <span class="text-[10px] uppercase tracking-wide text-muted">
                  Working weight (kg)
                </span>
                <UInput
                  size="xs"
                  type="number"
                  inputmode="decimal"
                  step="0.5"
                  class="w-24"
                  :model-value="workingWeightDisplayFor(exercise)"
                  :placeholder="workingWeightPlaceholderFor(exercise)"
                  @update:model-value="val => updateWorkingWeight(exercise, val)"
                />
                <span
                  v-if="feedbackLabelFor(exercise)"
                  class="text-[10px] text-muted"
                >
                  {{ feedbackLabelFor(exercise) }}
                </span>
              </div>
              <div
                v-if="isFeederSet(exercise)"
                class="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary/80"
              >
                <div
                  v-for="note in feederSetNotes"
                  :key="note"
                >
                  {{ note }}
                </div>
              </div>
              <div class="overflow-hidden rounded-lg bg-muted/5">
                <div
                  v-if="exercise.warmupSets && toNumber(exercise.warmupSets) > 0"
                  class="border-b-2 border-dashed border-muted/60 bg-primary/5 px-3 py-2"
                >
                  <p class="text-xs uppercase tracking-wide text-primary">
                    Warm-up
                  </p>
                  <p class="text-sm text-primary/80">
                    {{ exercise.warmupSets }} warm-up sets
                  </p>
                </div>
                <transition name="fade">
                  <div
                    v-if="warmupSummaryFor(exercise).length"
                    class="border-b border-muted/40 bg-primary/5 px-3 py-2 text-xs text-primary/80"
                  >
                    <div
                      v-for="item in warmupSummaryFor(exercise)"
                      :key="item"
                    >
                      {{ item }}
                    </div>
                  </div>
                </transition>
                <div
                  class="flex items-center justify-between px-3 py-3 bg-white/60 dark:bg-gray-900/40 cursor-pointer"
                  :class="[
                    setBorderClass(isMainCompleted(workout.id, exercise.id)),
                    isMainCompleted(workout.id, exercise.id)
                      ? 'border-t-2 border-solid border-muted'
                      : 'border-t-2 border-dashed border-muted/60'
                  ]"
                  :style="rowCompletionStyle(isMainCompleted(workout.id, exercise.id))"
                  @click="handleExerciseToggle(workout, exercise.id)"
                >
                  <div class="space-y-1 flex-1">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Main sets
                    </p>
                    <p class="text-sm text-muted">
                      {{ exercise.workingSets }} sets · {{ exercise.reps }} reps
                    </p>
                  </div>
                  <div
                    v-if="allowWeightEntryFor(exercise)"
                    class="flex flex-col items-end gap-1"
                  >
                    <div class="inline-flex overflow-hidden rounded-md border border-muted/40 bg-white/70 dark:bg-gray-900/50">
                      <UButton
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-trending-up"
                        @click.stop="() => { setFeedbackFor(exercise, 'up'); handleExerciseToggle(workout, exercise.id) }"
                        class="rounded-none border-0"
                      >
                        <span class="hidden sm:inline">Too light</span>
                      </UButton>
                      <UButton
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-equal"
                        @click.stop="() => { setFeedbackFor(exercise, 'hold'); handleExerciseToggle(workout, exercise.id) }"
                        class="rounded-none border-0"
                      >
                        <span class="hidden sm:inline">Just right</span>
                      </UButton>
                      <UButton
                        variant="outline"
                        color="neutral"
                        icon="i-lucide-trending-down"
                        @click.stop="() => { setFeedbackFor(exercise, 'down'); handleExerciseToggle(workout, exercise.id) }"
                        class="rounded-none border-0"
                      >
                        <span class="hidden sm:inline">Too heavy</span>
                      </UButton>
                    </div>
                  </div>
                  <div
                    v-else
                    class="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border-2 transition"
                    :class="isMainCompleted(workout.id, exercise.id) ? 'bg-primary text-white border-primary' : 'bg-transparent text-muted border-muted/60'"
                    aria-hidden="true"
                  >
                    <span class="text-base leading-none">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="!workoutFullyDone(workout)"
          class="pt-1"
        >
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-flag"
            @click="finishDay(workout)"
          >
            Finish Day
          </UButton>
        </div>
      </UCard>
    </div>

    <div
      v-if="upcomingWorkout"
      class="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <p class="text-xs uppercase tracking-wide text-primary">
        Next up
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-lg font-semibold">{{ upcomingWorkout.dayName }}</span>
        <UBadge
          color="neutral"
          variant="soft"
        >
          {{ upcomingWorkout.exercises.length }} exercises
        </UBadge>
      </div>
    </div>

    <div
      v-if="stickyTarget"
      class="pointer-events-none fixed inset-x-0 bottom-0 px-4 pb-5"
    >
      <div class="pointer-events-auto mx-auto max-w-3xl">
        <div class="overflow-hidden rounded-2xl border border-muted/40 bg-white/90 shadow-lg backdrop-blur dark:bg-gray-900/90">
          <div class="flex">
            <UButton
              class="h-14 flex-1 !rounded-none text-base"
              size="lg"
              color="primary"
              icon="i-heroicons-check-circle"
              @click="markStickyDone"
            >
              Mark {{ stickyTarget.exercise.name }} done
            </UButton>
            <div class="w-px self-stretch bg-muted/30" />
            <UButton
              class="h-14 w-16 !rounded-none"
              size="lg"
              color="neutral"
              variant="ghost"
              icon="i-lucide-skip-forward"
              @click="markStickySkipped"
            />
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
