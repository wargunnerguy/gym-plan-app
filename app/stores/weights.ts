type StoredWeight = {
  weight: number
  updatedAt: string
}

type WeightFeedback = {
  hint: 'up' | 'down' | 'hold'
  updatedAt: string
}

type WeightEntry = {
  last?: StoredWeight
  current?: StoredWeight
  feedback?: WeightFeedback
}

const STORAGE_KEY = 'plan-exercise-weights'

export const useWeightsStore = defineStore('weights', () => {
  const weights = ref<Record<string, WeightEntry>>({})

  const setCurrentWeight = (key: string, weight: number) => {
    if (!key) return
    if (!Number.isFinite(weight) || weight <= 0) {
      const entry = weights.value[key]
      if (!entry) return
      const { current: _removed, ...restEntry } = entry
      if (!restEntry.last && !restEntry.feedback) {
        const { [key]: _removedKey, ...rest } = weights.value
        weights.value = rest
      } else {
        weights.value = { ...weights.value, [key]: restEntry }
      }
      return
    }
    weights.value = {
      ...weights.value,
      [key]: {
        ...weights.value[key],
        current: { weight, updatedAt: new Date().toISOString() }
      }
    }
  }

  const commitCurrentAsLast = (key: string) => {
    const entry = weights.value[key]
    if (!entry?.current) return
    weights.value = {
      ...weights.value,
      [key]: {
        ...entry,
        last: entry.current
      }
    }
  }

  const clearCurrentWeight = (key: string) => {
    if (!key || !weights.value[key]) return
    const entry = weights.value[key]
    const { current: _removed, ...restEntry } = entry
    if (!restEntry.last && !restEntry.feedback) {
      const { [key]: _removedKey, ...rest } = weights.value
      weights.value = rest
    } else {
      weights.value = { ...weights.value, [key]: restEntry }
    }
  }

  const getLastWeight = (key: string) => {
    return weights.value[key]?.last?.weight ?? null
  }

  const getCurrentWeight = (key: string) => {
    return weights.value[key]?.current?.weight ?? null
  }

  const getWarmupBaseWeight = (key: string) => {
    return getLastWeight(key) ?? getCurrentWeight(key)
  }

  const setFeedback = (key: string, hint: 'up' | 'down' | 'hold') => {
    if (!key) return
    weights.value = {
      ...weights.value,
      [key]: {
        ...weights.value[key],
        feedback: { hint, updatedAt: new Date().toISOString() }
      }
    }
  }

  const getFeedback = (key: string) => {
    return weights.value[key]?.feedback?.hint ?? null
  }

  onMounted(() => {
    if (!import.meta.client) return
    const cached = localStorage.getItem(STORAGE_KEY)
    if (!cached) return
    try {
      weights.value = JSON.parse(cached)
    } catch {
      weights.value = {}
    }
  })

  watch(
    weights,
    (next) => {
      if (!import.meta.client) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    },
    { deep: true }
  )

  return {
    weights,
    setCurrentWeight,
    clearCurrentWeight,
    commitCurrentAsLast,
    getLastWeight,
    getCurrentWeight,
    getWarmupBaseWeight,
    setFeedback,
    getFeedback
  }
})
