type Completion = {
  completedAt: string
}

const STORAGE_KEY = 'plan-progress'
const STORAGE_KEY_EXERCISES = 'plan-exercise-progress'
const STORAGE_KEY_WARMUPS = 'plan-warmup-progress'
const STORAGE_KEY_META = 'plan-progress-meta'

export const useProgressStore = defineStore('progress', () => {
  const completions = ref<Record<string, Completion>>({})
  const exerciseCompletions = ref<Record<string, Completion>>({})
  const warmupCompletions = ref<Record<string, Completion>>({})
  const lastWorkoutDate = ref<string | null>(null)

  const keyFor = (phaseId: string, week: number, workoutId: string) => `${phaseId}:${week}:${workoutId}`
  const keyForExercise = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    `${phaseId}:${week}:${workoutId}:${exerciseId}`
  const keyForWarmup = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    `${phaseId}:${week}:${workoutId}:${exerciseId}:warmup`

  const todayKey = () => new Date().toISOString().slice(0, 10)

  const isCompleted = (phaseId: string, week: number, workoutId: string) => {
    const key = keyFor(phaseId, week, workoutId)
    return Boolean(completions.value[key])
  }

  const toggleCompletion = (phaseId: string, week: number, workoutId: string) => {
    const key = keyFor(phaseId, week, workoutId)
    if (completions.value[key]) {
      const { [key]: _removed, ...rest } = completions.value
      completions.value = rest
      lastWorkoutDate.value = null
    } else {
      completions.value[key] = { completedAt: new Date().toISOString() }
      lastWorkoutDate.value = todayKey()
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completions.value))
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify({ lastWorkoutDate: lastWorkoutDate.value }))
    }
  }

  const isExerciseCompleted = (phaseId: string, week: number, workoutId: string, exerciseId: string) => {
    const key = keyForExercise(phaseId, week, workoutId, exerciseId)
    return Boolean(exerciseCompletions.value[key])
  }

  const isWarmupCompleted = (phaseId: string, week: number, workoutId: string, exerciseId: string) => {
    const key = keyForWarmup(phaseId, week, workoutId, exerciseId)
    return Boolean(warmupCompletions.value[key])
  }

  const toggleExercise = (phaseId: string, week: number, workoutId: string, exerciseId: string) => {
    const key = keyForExercise(phaseId, week, workoutId, exerciseId)
    if (exerciseCompletions.value[key]) {
      const { [key]: _removed, ...rest } = exerciseCompletions.value
      exerciseCompletions.value = rest
    } else {
      exerciseCompletions.value[key] = { completedAt: new Date().toISOString() }
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_EXERCISES, JSON.stringify(exerciseCompletions.value))
    }
  }

  const toggleWarmup = (phaseId: string, week: number, workoutId: string, exerciseId: string) => {
    const key = keyForWarmup(phaseId, week, workoutId, exerciseId)
    if (warmupCompletions.value[key]) {
      const { [key]: _removed, ...rest } = warmupCompletions.value
      warmupCompletions.value = rest
    } else {
      warmupCompletions.value[key] = { completedAt: new Date().toISOString() }
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_WARMUPS, JSON.stringify(warmupCompletions.value))
    }
  }

  const clear = () => {
    completions.value = {}
    exerciseCompletions.value = {}
    warmupCompletions.value = {}
    lastWorkoutDate.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY_EXERCISES)
      localStorage.removeItem(STORAGE_KEY_WARMUPS)
      localStorage.removeItem(STORAGE_KEY_META)
    }
  }

  onMounted(() => {
    if (!import.meta.client) return
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        completions.value = JSON.parse(cached)
      } catch {
        completions.value = {}
      }
    }
    const exCached = localStorage.getItem(STORAGE_KEY_EXERCISES)
    if (exCached) {
      try {
        exerciseCompletions.value = JSON.parse(exCached)
      } catch {
        exerciseCompletions.value = {}
      }
    }
    const warmCached = localStorage.getItem(STORAGE_KEY_WARMUPS)
    if (warmCached) {
      try {
        warmupCompletions.value = JSON.parse(warmCached)
      } catch {
        warmupCompletions.value = {}
      }
    }
    const metaCached = localStorage.getItem(STORAGE_KEY_META)
    if (metaCached) {
      try {
        const parsed = JSON.parse(metaCached) as { lastWorkoutDate?: string }
        lastWorkoutDate.value = parsed.lastWorkoutDate || null
      } catch {
        lastWorkoutDate.value = null
      }
    }
  })

  return {
    completions,
    exerciseCompletions,
    isCompleted,
    toggleCompletion,
    isExerciseCompleted,
    toggleExercise,
    isWarmupCompleted,
    toggleWarmup,
    lastWorkoutDate,
    clear
  }
})
