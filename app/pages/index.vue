<script setup lang="ts">
const planStore = usePlanStore()
const progressStore = useProgressStore()

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

const selectedPhaseId = ref<string | null>(null)

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
  const firstWithWork = phases.value.find(p => phaseHasRemaining(p.id))
  selectedPhaseId.value = firstWithWork?.id ?? phases.value[0].id
}

watch(
  () => phaseOptions.value,
  () => pickInitialPhase(),
  { immediate: true }
)

const currentPhase = computed(() => {
  const phases = currentPlan.value?.phases || []
  if (!phases.length) return null
  return phases.find(p => p.id === selectedPhaseId.value) || phases[0]
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

const selectedWeek = ref<number | null>(null)

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

  const phase = phases.value.find(p => p.id === phaseId)
  const nextWeek = phase?.weeks.find(w => weekHasRemaining(phaseId, w.week))
  if (nextWeek) {
    selectedWeek.value = nextWeek.week
    return
  }

  // Phase complete, move to next phase with remaining work
  const nextPhase = phases.value.find(p => phaseHasRemaining(p.id))
  if (nextPhase) {
    selectedPhaseId.value = nextPhase.id
    pickInitialWeek()
    return
  }

  // All phases/weeks completed: reset to phase 1 / week 1 and clear progress
  if (phases.value.length) {
    progressStore.clear()
    selectedPhaseId.value = phases.value[0].id
    selectedWeek.value = phases.value[0].weeks[0]?.week ?? null
  }
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
  const warmDone = exercise.warmupSets ? isWarmupCompleted(workout.id, exercise.id) : true
  return mainDone && warmDone
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
  progressStore.toggleExercise(phaseId, week, workout.id, exerciseId)
  setOpenForExercise(workout.id, exerciseId, false)
  openNextActive(workout)
}

const handleWarmupToggle = (workout: WorkoutItem, exerciseId: string) => {
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week) return
  progressStore.toggleWarmup(phaseId, week, workout.id, exerciseId)
}

const completionPatternStyle = {
  backgroundImage: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.18) 0, rgba(0,0,0,0.18) 6px, transparent 6px, transparent 12px)',
  backgroundSize: '10px 10px'
}

const rowCompletionStyle = (done: boolean) => done ? completionPatternStyle : {}

const setBorderClass = (done: boolean) => done ? 'border-2 border-solid border-l-4 border-muted' : 'border-2 border-dashed border-muted/60'

const stickyTarget = computed(() => {
  const workout = currentWorkout.value
  const phaseId = currentPhase.value?.id
  const week = weekData.value?.week
  if (!phaseId || !week || !workout) return null

  const preferred = stickyExerciseRef.value?.workoutId === workout.id
    ? workout.exercises.find(ex => ex.id === stickyExerciseRef.value?.exerciseId)
    : null

  const activeId = activeExerciseId(workout)
  const fallback = activeId ? workout.exercises.find(ex => ex.id === activeId) : null
  const candidate = preferred && !isExerciseDone(workout, preferred) ? preferred : fallback
  if (!candidate || isExerciseDone(workout, candidate)) return null

  return {
    workoutId: workout.id,
    exercise: candidate
  }
})

watch(
  () => [currentWorkout.value?.id, selectedWeek.value, selectedPhaseId.value],
  () => {
    const workout = currentWorkout.value
    if (!workout) {
      stickyExerciseRef.value = null
      return
    }
    const nextId = activeExerciseId(workout)
    stickyExerciseRef.value = nextId ? { workoutId: workout.id, exerciseId: nextId } : null
  },
  { immediate: true }
)

const markStickyDone = () => {
  if (!stickyTarget.value || !currentWorkout.value) return
  const exercise = stickyTarget.value.exercise
  if (exercise.warmupSets && !isWarmupCompleted(currentWorkout.value.id, exercise.id)) {
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
    const hasWarmup = Boolean(exercise.warmupSets)
    total += hasWarmup ? 2 : 1
    if (phaseId && week) {
      if (hasWarmup && isWarmupCompleted(workout.id, exercise.id)) completed += 1
      if (isMainCompleted(workout.id, exercise.id)) completed += 1
    }
  })

  return { completed, total: total || 1 }
}

const toNumber = (input: string) => {
  const match = String(input || '').match(/(\d+(\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

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
    <header class="space-y-2">
      <p class="text-sm uppercase tracking-wide text-muted">
        Plan
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-semibold">
          {{ currentPlan?.name || 'Loading plan' }}
        </h1>
        <span
          v-if="appVersion"
          class="text-sm font-semibold text-muted"
        >
          v{{ appVersion }}
        </span>
      </div>
    </header>

    <div
      v-if="planStore.error"
      class="rounded-lg border border-amber-400/60 bg-amber-50/60 px-4 py-3 text-amber-900 dark:border-amber-300/60 dark:bg-amber-900/20 dark:text-amber-100"
    >
      {{ planStore.error }}
    </div>

    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-muted">
          Phase
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="phase in phases"
            :key="phase.id"
            size="xs"
            :color="phase.id === selectedPhaseId ? 'primary' : 'neutral'"
            :variant="phase.id === selectedPhaseId ? 'outline' : 'ghost'"
            :class="phase.id === selectedPhaseId ? 'border-2 font-semibold' : 'font-normal'"
            @click="selectedPhaseId = phase.id"
          >
            {{ phase.name }}
          </UButton>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-muted">
          Week
        </p>
        <div class="flex flex-wrap items-center gap-0">
          <template v-for="(week, idx) in weeks" :key="week.week">
            <button
              type="button"
              class="flex items-center justify-center rounded-full border transition-all"
              :class="week.week === selectedWeek ? 'h-8 w-8 border-2 border-primary font-semibold text-primary text-xs' : 'h-4 w-4 border-muted/60 bg-muted/40'"
              :aria-label="`Week ${week.week}`"
              @click="selectedWeek = week.week"
            >
              <span v-if="week.week === selectedWeek">{{ week.week }}</span>
            </button>
            <span
              v-if="idx < weeks.length - 1"
              class="mx-1 h-px w-8 bg-muted/60"
            >
            </span>
          </template>
        </div>
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
              Day {{ workout.order }}
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
            <UBadge
              v-if="workout.exercises.length"
              color="neutral"
              variant="outline"
            >
              {{ workout.exercises.length }} exercises
            </UBadge>
            <UButton
              size="xs"
              :color="progressStore.isCompleted(currentPhase?.id || '', weekData?.week || 0, workout.id) ? 'primary' : 'neutral'"
              variant="soft"
              @click="() => { progressStore.toggleCompletion(currentPhase?.id || '', weekData?.week || 0, workout.id); advanceIfCompleted() }"
            >
              <span v-if="progressStore.isCompleted(currentPhase?.id || '', weekData?.week || 0, workout.id)">Completed</span>
              <span v-else>Mark done</span>
            </UButton>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="exercise in workout.exercises"
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
                <span class="text-xs text-muted">
                  Rest {{ exercise.rest }}
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
              <div class="overflow-hidden rounded-lg bg-muted/5">
                <div
                  v-if="exercise.warmupSets"
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
                  <div class="space-y-1">
                    <p class="text-xs uppercase tracking-wide text-muted">
                      Main sets
                    </p>
                    <p class="text-sm text-muted">
                      {{ exercise.workingSets }} sets · {{ exercise.reps }} reps
                    </p>
                  </div>
                  <div
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
              <UBadge
                v-if="exercise.group"
                color="primary"
                variant="soft"
              >
                {{ exercise.group }}
              </UBadge>
              <div
                v-if="exercise.subs?.length"
                class="flex flex-wrap gap-2 pt-1"
              >
                <div
                  v-for="(sub, idx) in exercise.subs"
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
          color="primary"
          variant="solid"
        >
          {{ upcomingWorkout.focus }}
        </UBadge>
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
            color="primary"
            class="h-14 text-base"
            icon="i-lucide-check-circle-2"
            @click="markStickyDone"
          >
            Mark {{ stickyTarget.exercise.name }} done
          </UButton>
        </div>
      </div>
    </div>
  </UContainer>
</template>
