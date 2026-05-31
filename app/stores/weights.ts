import { skipHydrate } from 'pinia'

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
  const config = useRuntimeConfig()
  const weights = skipHydrate(ref<Record<string, WeightEntry>>({}))

  const postRow = (key: string, type: string, value: string) => {
    const url = config.public.userdataUrl
    if (!url) return
    const params = new URLSearchParams({ action: 'post', key, type, value, updatedAt: new Date().toISOString() })
    $fetch(`${url}?${params}`).catch(() => {})
  }

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
    const updatedAt = new Date().toISOString()
    weights.value = {
      ...weights.value,
      [key]: { ...weights.value[key], current: { weight, updatedAt } }
    }
  }

  const commitCurrentAsLast = (key: string) => {
    const entry = weights.value[key]
    if (!entry?.current) return
    weights.value = { ...weights.value, [key]: { ...entry, last: entry.current } }
    postRow(key, 'weight_last', String(entry.current.weight))
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

  const getLastWeight = (key: string) => weights.value[key]?.last?.weight ?? null

  const getCurrentWeight = (key: string) => weights.value[key]?.current?.weight ?? null

  const getWarmupBaseWeight = (key: string) => getLastWeight(key) ?? getCurrentWeight(key)

  const setFeedback = (key: string, hint: 'up' | 'down' | 'hold') => {
    if (!key) return
    weights.value = {
      ...weights.value,
      [key]: { ...weights.value[key], feedback: { hint, updatedAt: new Date().toISOString() } }
    }
    postRow(key, 'weight_feedback', hint)
  }

  const getFeedback = (key: string) => weights.value[key]?.feedback?.hint ?? null

  onMounted(() => {
    if (!import.meta.client) return
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Record<string, WeightEntry> | null
        weights.value = parsed && typeof parsed === 'object' ? { ...parsed } : {}
      } catch {
        weights.value = {}
      }
    }

    const url = config.public.userdataUrl
    if (!url) return

    // Merge weights from Apps Script in background
    $fetch<{ weights?: Record<string, WeightEntry> }>(url).then((remote) => {
      if (!remote?.weights) return
      weights.value = { ...weights.value, ...remote.weights }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(weights.value))
    }).catch(() => {})
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
