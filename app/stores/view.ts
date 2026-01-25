type ViewState = {
  phaseId: string | null
  week: number | null
  workoutId: string | null
  exerciseId: string | null
}

const STORAGE_KEY = 'plan-view-state'

export const useViewStore = defineStore('view', () => {
  const viewState = ref<ViewState>({
    phaseId: null,
    week: null,
    workoutId: null,
    exerciseId: null
  })
  const hydrated = ref(false)

  const update = (patch: Partial<ViewState>) => {
    viewState.value = { ...viewState.value, ...patch }
  }

  const clear = () => {
    viewState.value = {
      phaseId: null,
      week: null,
      workoutId: null,
      exerciseId: null
    }
  }

  onMounted(() => {
    if (!import.meta.client) return
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        viewState.value = { ...viewState.value, ...JSON.parse(cached) }
      } catch {
        viewState.value = {
          phaseId: null,
          week: null,
          workoutId: null,
          exerciseId: null
        }
      }
    }
    hydrated.value = true
  })

  watch(
    viewState,
    (next) => {
      if (!import.meta.client) return
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    },
    { deep: true }
  )

  return {
    viewState,
    hydrated,
    update,
    clear
  }
})
