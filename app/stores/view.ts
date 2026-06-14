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
  const config = useRuntimeConfig()
  const viewState = skipHydrate(ref<ViewState>({
    phaseId: null,
    week: null,
    workoutId: null,
    exerciseId: null,
    exerciseVariants: {}
  }))
  const hydrated = ref(false)
  const remoteViewStateLoaded = ref(false)

  const postRow = (key: string, type: string, value: string) => {
    const url = config.public.userdataUrl
    if (!url) return
    const params = new URLSearchParams({ action: 'post', key, type, value, updatedAt: new Date().toISOString() })
    $fetch(`${url}?${params}`).catch(() => {})
  }

  const update = (patch: Partial<ViewState>) => {
    viewState.value = { ...viewState.value, ...patch }
    if ('phaseId' in patch && patch.phaseId) {
      postRow('meta', 'view_phaseId', patch.phaseId)
    }
    if ('week' in patch && patch.week != null) {
      postRow('meta', 'view_week', String(patch.week))
    }
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
    const next = (current + 1) % totalVariants
    viewState.value = {
      ...viewState.value,
      exerciseVariants: {
        ...viewState.value.exerciseVariants,
        [exerciseId]: next,
      }
    }
    postRow(exerciseId, 'exercise_variant', String(next))
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

    const url = config.public.userdataUrl
    if (!url) return
    $fetch<{ exerciseVariants?: Record<string, number>, viewPhaseId?: string, viewWeek?: number }>(url).then((remote) => {
      const patch: Partial<ViewState> = {}
      if (remote?.exerciseVariants) {
        patch.exerciseVariants = { ...viewState.value.exerciseVariants, ...remote.exerciseVariants }
      }
      if (remote?.viewPhaseId) patch.phaseId = remote.viewPhaseId
      if (remote?.viewWeek != null) patch.week = remote.viewWeek
      if (Object.keys(patch).length) {
        viewState.value = { ...viewState.value, ...patch }
      }
      remoteViewStateLoaded.value = true
    }).catch(() => {
      remoteViewStateLoaded.value = true
    })
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
    remoteViewStateLoaded,
    update,
    clear,
    cycleExerciseVariant
  }
})
