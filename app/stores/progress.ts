type Completion = {
  completedAt: string
}

const STORAGE_KEY = 'plan-progress'

export const useProgressStore = defineStore('progress', () => {
  const completions = ref<Record<string, Completion>>({})

  const keyFor = (phaseId: string, week: number, workoutId: string) => `${phaseId}:${week}:${workoutId}`

  const isCompleted = (phaseId: string, week: number, workoutId: string) => {
    const key = keyFor(phaseId, week, workoutId)
    return Boolean(completions.value[key])
  }

  const toggleCompletion = (phaseId: string, week: number, workoutId: string) => {
    const key = keyFor(phaseId, week, workoutId)
    if (completions.value[key]) {
      const { [key]: _removed, ...rest } = completions.value
      completions.value = rest
    } else {
      completions.value[key] = { completedAt: new Date().toISOString() }
    }
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(completions.value))
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
  })

  return { completions, isCompleted, toggleCompletion }
})
