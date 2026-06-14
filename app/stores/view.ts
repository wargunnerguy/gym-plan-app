import { skipHydrate } from 'pinia'

type ViewState = {
  phaseId: string | null
  week: number | null
  workoutId: string | null
  exerciseId: string | null
  exerciseVariants: Record<string, number>
}

const STORAGE_KEY = 'plan-view-state'

export const useViewStore = defineStore('view', () => {
  const viewState = skipHydrate(ref<ViewState>({
    phaseId: null,
    week: null,
    workoutId: null,
    exerciseId: null,
    exerciseVariants: {}
  }))
  const hydrated = ref(false)

  const update = (patch: Partial<ViewState>) => {
    viewState.value = { ...viewState.value, ...patch }
  }

  const clear = () => {
    viewState.value = {
      phaseId: null,
      week: null,
      workoutId: null,
      exerciseId: null,
      exerciseVariants: {}
    }
  }

  const cycleExerciseVariant = (exerciseId: string, totalVariants: number) => {
    const current = viewState.value.exerciseVariants[exerciseId] ?? 0
    viewState.value = {
      ...viewState.value,
      exerciseVariants: {
        ...viewState.value.exerciseVariants,
        [exerciseId]: (current + 1) % totalVariants,
      }
    }
  }

  onMounted(() => {
    if (!import.meta.client) return
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Partial<ViewState> | null
        viewState.value = {
          ...viewState.value,
          ...(parsed && typeof parsed === 'object' ? parsed : {})
        }
      } catch {
        viewState.value = {
          phaseId: null,
          week: null,
          workoutId: null,
          exerciseId: null,
          exerciseVariants: {}
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
    clear,
    cycleExerciseVariant
  }
})
