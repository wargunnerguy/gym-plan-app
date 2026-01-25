<script setup lang="ts">
const planStore = usePlanStore()
const progressStore = useProgressStore()
const viewStore = useViewStore()
const weightsStore = useWeightsStore()

type ExerciseItem = {
  id: string
  name: string
  warmupSets: string
  workingSets: string
  reps: string
  rest: string
  rpe: string
  group?: string
  notes?: string
  subs?: { name: string, link?: string }[]
  link?: string
}

type WorkoutItem = {
  id: string
  dayName: string
  focus: string
  order: number
  exercises: ExerciseItem[]
}

const appConfig = useAppConfig()
const appVersion = computed(() => appConfig?.appVersion || '')

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
  selectedPhaseId.value = firstWithWork?.id ?? phases.value[0].id
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
    selectedWeek.value = weeks[0].value
    return
  }
  if (selectedWeek.value && currentPhase.value?.weeks.some(week => week.week === selectedWeek.value)) {
    return
  }
  const firstWithWorkLeft = currentPhase.value?.weeks.find(week =>
    week.workouts.some(w => !progressStore.isCompleted(phaseId, week.week, w.id))
  )
  selectedWeek.value = (firstWithWorkLeft?.week ?? weeks[0].value)
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
  if (storedPhaseId && phases.value.some(p => p.id === storedPhaseId)) {
    selectedPhaseId.value = storedPhaseId
  }
  const phase = phases.value.find(p => p.id === (storedPhaseId ?? selectedPhaseId.value))
  const storedWeek = viewStore.viewState.week
  if (storedWeek && phase?.weeks.some(week => week.week === storedWeek)) {
    selectedWeek.value = storedWeek
  }
  appliedViewState.value = true
}

watch(
  () => [phases.value.length, viewStore.viewState.phaseId, viewStore.viewState.week],
  () => applyViewState(),
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

const currentWorkout = computed(() => nextWorkout.value)

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
    selectedPhaseId.value = ordered[0].id
    selectedWeek.value = ordered[0].weeks[0]?.week ?? null
    return
  }

  selectedPhaseId.value = ordered[nextPhaseIdx].id
  pickInitialWeek()
}

const isMainCompleted = (workoutId: string, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return false
  return progressStore.isExerciseCompleted(phaseId, week, workoutId, exerciseId)
}

const isWarmupCompleted = (workoutId: string, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return false
  return progressStore.isWarmupCompleted(phaseId, week, workoutId, exerciseId)
}

const isExerciseDone = (workout: WorkoutItem, exercise: ExerciseItem) => {
  const mainDone = isMainCompleted(workout.id, exercise.id)
  const hasWarmup = toNumber(exercise.warmupSets) > 0
  const warmDone = hasWarmup ? isWarmupCompleted(workout.id, exercise.id) : true
  return mainDone && warmDone
}

const nextIncompleteSegment = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return null

  for (const exercise of workout.exercises) {
    const hasWarmup = toNumber(exercise.warmupSets) > 0
    if (hasWarmup && !isWarmupCompleted(workout.id, exercise.id)) {
      return { exercise, stage: 'warmup' as const }
    }
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
      weightsStore.commitCurrentAsLast(weightKeyFor(phaseId, exercise))
      weightsStore.clearCurrentWeight(weightKeyFor(phaseId, exercise))
    }
  }
  setOpenForExercise(workout.id, exerciseId, false)
  openNextActive(workout)
  syncWorkoutCompletion(workout)
}

const handleWarmupToggle = (workout: WorkoutItem, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  progressStore.toggleWarmup(phaseId, week, workout.id, exerciseId)
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

const isLinkedAbove = (workout: WorkoutItem, idx: number) => {
  const current = workout.exercises[idx]
  const prev = workout.exercises[idx - 1]
  if (!current?.group || !prev?.group) return false
  return current.group === prev.group
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
  const { exercise, stage } = stickyTarget.value
  if (stage === 'warmup') {
    handleWarmupToggle(currentWorkout.value, exercise.id)
  } else {
    handleExerciseToggle(currentWorkout.value, exercise.id)
  }
}

const workoutCompletionParts = (workout: WorkoutItem) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  let total = 0
  let completed = 0

  workout.exercises.forEach(exercise => {
    const hasWarmup = toNumber(exercise.warmupSets) > 0
    total += hasWarmup ? 2 : 1
    if (phaseId && week) {
      if (hasWarmup && isWarmupCompleted(workout.id, exercise.id)) completed += 1
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

const toNumber = (input: string) => {
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
  return weightsStore.getLastWeight(weightKeyFor(phaseId, exercise))
}

const currentWeightFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  return weightsStore.getCurrentWeight(weightKeyFor(phaseId, exercise))
}

const warmupBaseWeightFor = (exercise: ExerciseItem) => {
  if (!allowWeightEntryFor(exercise)) return null
  const phaseId = currentPhase.value?.id
  if (!phaseId) return null
  return weightsStore.getWarmupBaseWeight(weightKeyFor(phaseId, exercise))
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
  return weight ? `${formatWeight(weight)} kg` : 'No previous weight'
}

const updateWorkingWeight = (exercise: ExerciseItem, value: string | number) => {
  const phaseId = currentPhase.value?.id
  if (!phaseId) return
  const raw = typeof value === 'number' ? value : Number(String(value || '').replace(',', '.'))
  if (!Number.isFinite(raw) || raw <= 0) {
    weightsStore.clearCurrentWeight(weightKeyFor(phaseId, exercise))
    return
  }
  weightsStore.setCurrentWeight(weightKeyFor(phaseId, exercise), raw)
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

  if (isPhase3HighReps) {
    if (warmupSets <= 1) {
      return [{ percentRange: [0.5, 0.7], reps: '5-10 reps' }]
    }
    return [
      { percent: 0.5, reps: '5-10 reps' },
      { percent: 0.7, reps: '5-10 reps' }
    ]
  }

  if (warmupSets === 1) {
    return [{ percent: 0.6, reps: 'same reps' }]
  }
  if (warmupSets === 2) {
    return [
      { percent: 0.5, reps: 'same reps' },
      { percent: 0.7, reps: 'few less reps' }
    ]
  }
  return [
    { percent: 0.45, reps: 'same reps' },
    { percent: 0.65, reps: 'few less reps' },
    { percent: 0.85, reps: 'few less reps' }
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
  const hint = weightsStore.getFeedback(weightKeyFor(phaseId, exercise))
  if (!hint) return null
  if (hint === 'up') return 'Too light last time — increase'
  if (hint === 'down') return 'Too heavy last time — decrease'
  return 'Just right last time — keep'
}

const setFeedbackFor = (exercise: ExerciseItem, hint: 'up' | 'down' | 'hold') => {
  const phaseId = currentPhase.value?.id
  if (!phaseId) return
  weightsStore.setFeedback(weightKeyFor(phaseId, exercise), hint)
}

const cleanSubs = (subs?: { name: string, link?: string }[]) => {
  return (subs || []).filter(sub => {
    const name = (sub?.name || '').trim().toLowerCase()
    return name && name !== 'n/a'
  })
}

const settingsOpen = useState('settingsOpen', () => false)

const parseRestRange = (rest: string) => {
  const matches = String(rest || '').match(/(\d+(\.\d+)?)/g)
  if (!matches || !matches.length) return { min: 0, max: 0 }
  if (matches.length === 1) {
    const val = Number(matches[0])
    return { min: val, max: val }
  }
  return { min: Number(matches[0]), max: Number(matches[1]) }
}

const exerciseDuration = (exercise: ExerciseItem) => {
  const warmups = toNumber(exercise.warmupSets)
  const workings = toNumber(exercise.workingSets)
  const sets = warmups + workings || 1
  const restRange = parseRestRange(exercise.rest)
  const restMinSec = restRange.min * 60
  const restMaxSec = restRange.max * 60
  const workPerSetSec = 90 // heuristic: average set effort
  const setupPerSetSec = 20 // transition/setup buffer per set
  const totalMin = sets * (workPerSetSec + setupPerSetSec) + Math.max(0, sets - 1) * restMinSec
  const totalMax = sets * (workPerSetSec + setupPerSetSec) + Math.max(0, sets - 1) * restMaxSec
  return {
    minSets: totalMin / 60,
    maxSets: totalMax / 60,
    restAfterMin: restRange.min,
    restAfterMax: restRange.max
  }
}

const workoutDuration = (workout: WorkoutItem) => {
  const totals = workout.exercises.map((ex: ExerciseItem) => exerciseDuration(ex))
  const minRaw = totals.reduce((sum: number, t, idx) => {
    const restAfter = idx < totals.length - 1 ? t.restAfterMin : 0
    return sum + t.minSets + restAfter
  }, 0)
  const maxRaw = totals.reduce((sum: number, t, idx) => {
    const restAfter = idx < totals.length - 1 ? t.restAfterMax : 0
    return sum + t.maxSets + restAfter
  }, 0)
  return {
    min: Math.ceil(minRaw),
    max: Math.ceil(maxRaw)
  }
}
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
            <UButton
              v-for="week in weeks"
              :key="week.week"
              size="xs"
              :color="week.week === selectedWeek ? 'primary' : 'neutral'"
              :variant="week.week === selectedWeek ? 'soft' : 'ghost'"
              @click="() => { selectedWeek = week.week; settingsOpen = false }"
            >
              Week {{ week.week }}
            </UButton>
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

        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">
              Day {{ workout.order }}<span v-if="weekData?.workouts?.length">/{{ weekData?.workouts.length }}</span>
            </p>
            <h2 class="text-xl font-semibold">
              {{ workout.dayName }}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">
              {{
                (() => {
                  const d = workoutDuration(workout)
                  return d.min === d.max ? `${d.min} min` : `${d.min}–${d.max} min`
                })()
              }}
            </span>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="(exercise, idx) in workout.exercises"
            :key="exercise.id"
            class="rounded-lg border border-muted/50 bg-muted/5 px-3 py-2 transition-all"
            :class="isExerciseDone(workout, exercise) ? 'opacity-60 line-through border-primary/40 bg-primary/5' : ''"
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
                  v-if="!exercise.link"
                  class="text-sm font-medium"
                >
                  {{ exercise.name }}
                </span>
                <a
                  v-else
                  class="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  :href="exercise.link"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ exercise.name }}
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
              </div>
              <div class="flex items-center gap-2">
                <UBadge
                  :color="rpeColor(exercise.rpe)"
                  variant="outline"
                >
                  RPE {{ exercise.rpe }}
                </UBadge>
                <span class="text-xs text-muted">
                  {{
                    (() => {
                      const d = exerciseDuration(exercise)
                      return `${Math.ceil(d.maxSets + d.restAfterMax)}m`
                    })()
                  }}
                </span>
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
                  class="flex items-center justify-between px-3 py-2 bg-primary/5 cursor-pointer"
                  :class="[
                    setBorderClass(isWarmupCompleted(workout.id, exercise.id)),
                    isWarmupCompleted(workout.id, exercise.id)
                      ? 'border-b-2 border-solid border-muted'
                      : 'border-b-2 border-dashed border-muted/60'
                  ]"
                  :style="rowCompletionStyle(isWarmupCompleted(workout.id, exercise.id))"
                  @click="handleWarmupToggle(workout, exercise.id)"
                >
                  <div class="space-y-1">
                    <p class="text-xs uppercase tracking-wide text-primary">
                      Warm-up
                    </p>
                    <p class="text-sm text-primary/80">
                      {{ exercise.warmupSets }} sets · {{ exercise.reps }} reps
                    </p>
                  </div>
                  <div
                    class="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full border-2 transition"
                    :class="isWarmupCompleted(workout.id, exercise.id) ? 'bg-primary text-white border-primary' : 'bg-transparent text-muted border-muted/60'"
                    aria-hidden="true"
                  >
                    <span class="text-base leading-none">✓</span>
                  </div>
                </div>
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
            <template v-if="!isExerciseDone(workout, exercise) && isDetailsOpen(workout, exercise.id)">
              <div
                v-if="cleanSubs(exercise.subs).length"
                class="flex flex-wrap gap-2 pt-1"
              >
                <div
                  v-for="(sub, idx) in cleanSubs(exercise.subs)"
                  :key="idx"
                  class="flex items-center gap-1"
                >
                  <UBadge
                    color="primary"
                    variant="ghost"
                  >
                    Sub:
                    <span v-if="!sub.link">
                      {{ sub.name }}
                    </span>
                    <a
                      v-else
                      class="text-primary underline-offset-4 hover:underline"
                      :href="sub.link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {{ sub.name }}
                    </a>
                  </UBadge>
                </div>
              </div>
            </template>
          </div>
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
        <div class="rounded-2xl border border-muted/40 bg-white/90 shadow-lg backdrop-blur dark:bg-gray-900/90">
          <UButton
            block
            size="lg"
            :color="stickyTarget.stage === 'warmup' ? 'warning' : 'primary'"
            class="h-14 text-base"
            icon="i-heroicons-check-circle"
            @click="markStickyDone"
          >
            <template v-if="stickyTarget.stage === 'warmup'">
              Mark warm-up for {{ stickyTarget.exercise.name }} done
            </template>
            <template v-else>
              Mark {{ stickyTarget.exercise.name }} done
            </template>
          </UButton>
        </div>
      </div>
    </div>

  </UContainer>
</template>
