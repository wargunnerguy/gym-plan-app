import { skipHydrate } from 'pinia'

type Completion = {
  completedAt: string
}

type Skip = {
  skippedAt: string
}

const STORAGE_KEY = 'plan-progress'
const STORAGE_KEY_EXERCISES = 'plan-exercise-progress'
const STORAGE_KEY_WARMUPS = 'plan-warmup-progress'
const STORAGE_KEY_SKIPS = 'plan-skip-progress'
const STORAGE_KEY_META = 'plan-progress-meta'

export const useProgressStore = defineStore('progress', () => {
  const config = useRuntimeConfig()

  const completions = skipHydrate(ref<Record<string, Completion>>({}))
  const exerciseCompletions = skipHydrate(ref<Record<string, Completion>>({}))
  const warmupCompletions = skipHydrate(ref<Record<string, Completion>>({}))
  const skipCompletions = skipHydrate(ref<Record<string, Skip>>({}))
  const lastWorkoutDate = skipHydrate(ref<string | null>(null))

  const keyFor = (phaseId: string, week: number, workoutId: string) => `${phaseId}:${week}:${workoutId}`
  const keyForExercise = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    `${phaseId}:${week}:${workoutId}:${exerciseId}`
  const keyForWarmup = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    `${phaseId}:${week}:${workoutId}:${exerciseId}:warmup`
  const keyForSkip = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    `${phaseId}:${week}:${workoutId}:${exerciseId}:skip`

  const todayKey = () => new Date().toISOString().slice(0, 10)

  const postRow = (key: string, type: string, value: string) => {
    const url = config.public.userdataUrl
    if (!url) return
    const params = new URLSearchParams({ action: 'post', key, type, value, updatedAt: new Date().toISOString() })
    $fetch(`${url}?${params}`).catch(() => {})
  }

  const isCompleted = (phaseId: string, week: number, workoutId: string) =>
    Boolean(completions.value[keyFor(phaseId, week, workoutId)])

  const isExerciseCompleted = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    Boolean(exerciseCompletions.value[keyForExercise(phaseId, week, workoutId, exerciseId)])

  const isWarmupCompleted = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    Boolean(warmupCompletions.value[keyForWarmup(phaseId, week, workoutId, exerciseId)])

  const isSkipped = (phaseId: string, week: number, workoutId: string, exerciseId: string) =>
    Boolean(skipCompletions.value[keyForSkip(phaseId, week, workoutId, exerciseId)])

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
    postRow(key, 'workout', completions.value[key]?.completedAt ?? '')
    postRow('meta', 'lastWorkoutDate', lastWorkoutDate.value ?? '')
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
    postRow(key, 'exercise', exerciseCompletions.value[key]?.completedAt ?? '')
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
    postRow(key, 'warmup', warmupCompletions.value[key]?.completedAt ?? '')
  }

  const toggleSkip = (phaseId: string, week: number, workoutId: string, exerciseId: string) => {
    const key = keyForSkip(phaseId, week, workoutId, exerciseId)
    if (skipCompletions.value[key]) {
      const { [key]: _removed, ...rest } = skipCompletions.value
      skipCompletions.value = rest
    } else {
      skipCompletions.value[key] = { skippedAt: new Date().toISOString() }
      // Ensure warmup is marked done so it never blocks day completion
      const warmupKey = keyForWarmup(phaseId, week, workoutId, exerciseId)
      if (!warmupCompletions.value[warmupKey]) {
        warmupCompletions.value[warmupKey] = { completedAt: new Date().toISOString() }
        if (import.meta.client) {
          localStorage.setItem(STORAGE_KEY_WARMUPS, JSON.stringify(warmupCompletions.value))
        }
        postRow(warmupKey, 'warmup', warmupCompletions.value[warmupKey].completedAt)
      }
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY_SKIPS, JSON.stringify(skipCompletions.value))
    }
    postRow(key, 'skip', skipCompletions.value[key]?.skippedAt ?? '')
  }

  const clear = () => {
    completions.value = {}
    exerciseCompletions.value = {}
    warmupCompletions.value = {}
    skipCompletions.value = {}
    lastWorkoutDate.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(STORAGE_KEY_EXERCISES)
      localStorage.removeItem(STORAGE_KEY_WARMUPS)
      localStorage.removeItem(STORAGE_KEY_SKIPS)
      localStorage.removeItem(STORAGE_KEY_META)
    }
    postRow('meta', 'clearAt', new Date().toISOString())
  }

  const clearWeek = (phaseId: string, week: number) => {
    const prefix = `${phaseId}:${week}:`
    const filterMap = (map: Ref<Record<string, unknown>>, type: string) => {
      const toRemove = Object.keys(map.value).filter(k => k.startsWith(prefix))
      toRemove.forEach(key => postRow(key, type, ''))
      map.value = Object.fromEntries(Object.entries(map.value).filter(([k]) => !k.startsWith(prefix)))
    }
    filterMap(completions, 'workout')
    filterMap(exerciseCompletions, 'exercise')
    filterMap(warmupCompletions, 'warmup')
    filterMap(skipCompletions, 'skip')
    lastWorkoutDate.value = null
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completions.value))
      localStorage.setItem(STORAGE_KEY_EXERCISES, JSON.stringify(exerciseCompletions.value))
      localStorage.setItem(STORAGE_KEY_WARMUPS, JSON.stringify(warmupCompletions.value))
      localStorage.setItem(STORAGE_KEY_SKIPS, JSON.stringify(skipCompletions.value))
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify({ lastWorkoutDate: null }))
    }
    postRow('meta', 'lastWorkoutDate', '')
  }

  const tryParse = <T>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  onMounted(() => {
    if (!import.meta.client) return

    completions.value = tryParse<Record<string, Completion>>(localStorage.getItem(STORAGE_KEY), {})
    exerciseCompletions.value = tryParse<Record<string, Completion>>(localStorage.getItem(STORAGE_KEY_EXERCISES), {})
    warmupCompletions.value = tryParse<Record<string, Completion>>(localStorage.getItem(STORAGE_KEY_WARMUPS), {})
    skipCompletions.value = tryParse<Record<string, Skip>>(localStorage.getItem(STORAGE_KEY_SKIPS), {})
    const meta = tryParse<{ lastWorkoutDate?: string }>(localStorage.getItem(STORAGE_KEY_META), {})
    lastWorkoutDate.value = meta.lastWorkoutDate || null

    const url = config.public.userdataUrl
    if (!url) return

    // Merge from Apps Script in background; remote wins for any present value
    $fetch<{
      completions?: Record<string, Completion>
      exerciseCompletions?: Record<string, Completion>
      warmupCompletions?: Record<string, Completion>
      skipCompletions?: Record<string, Skip>
      lastWorkoutDate?: string | null
    }>(url).then((remote) => {
      if (!remote) return
      if (remote.completions) {
        completions.value = { ...completions.value, ...remote.completions }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(completions.value))
      }
      if (remote.exerciseCompletions) {
        exerciseCompletions.value = { ...exerciseCompletions.value, ...remote.exerciseCompletions }
        localStorage.setItem(STORAGE_KEY_EXERCISES, JSON.stringify(exerciseCompletions.value))
      }
      if (remote.warmupCompletions) {
        warmupCompletions.value = { ...warmupCompletions.value, ...remote.warmupCompletions }
        localStorage.setItem(STORAGE_KEY_WARMUPS, JSON.stringify(warmupCompletions.value))
      }
      if (remote.skipCompletions) {
        skipCompletions.value = { ...skipCompletions.value, ...remote.skipCompletions }
        localStorage.setItem(STORAGE_KEY_SKIPS, JSON.stringify(skipCompletions.value))
      }
      if (remote.lastWorkoutDate) {
        lastWorkoutDate.value = remote.lastWorkoutDate
        localStorage.setItem(STORAGE_KEY_META, JSON.stringify({ lastWorkoutDate: lastWorkoutDate.value }))
      }
    }).catch(() => {})
  })

  return {
    completions,
    exerciseCompletions,
    skipCompletions,
    isCompleted,
    toggleCompletion,
    isExerciseCompleted,
    toggleExercise,
    isWarmupCompleted,
    toggleWarmup,
    isSkipped,
    toggleSkip,
    lastWorkoutDate,
    clear,
    clearWeek
  }
})
