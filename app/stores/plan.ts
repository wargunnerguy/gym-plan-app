import type { NormalizedPlan } from '@/server/utils/transformPlan'

type PlanResponse = { updatedAt: string } & NormalizedPlan

export const usePlanStore = defineStore('plan', () => {
  const data = ref<NormalizedPlan['plans']>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<string | null>(null)

  const activePlan = computed(() => data.value.find((plan) => plan.active) || data.value[0])

  const load = async () => {
    loading.value = true
    error.value = null
    try {
      const { data: response, error: fetchError } = await useFetch<PlanResponse>('/plan.json', {
        key: 'plan-fetch',
        dedupe: 'defer'
      })
      if (fetchError.value) throw fetchError.value
      if (response.value) {
        data.value = response.value.plans
        lastUpdated.value = response.value.updatedAt
        if (process.client) {
          localStorage.setItem('plan-cache', JSON.stringify(response.value))
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load plan'
      if (process.client) {
        const cached = localStorage.getItem('plan-cache')
        if (cached) {
          const parsed = JSON.parse(cached) as PlanResponse
          data.value = parsed.plans
          lastUpdated.value = parsed.updatedAt
          error.value = null
        }
      }
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    const cached = process.client ? localStorage.getItem('plan-cache') : null
    if (cached) {
      const parsed = JSON.parse(cached) as PlanResponse
      data.value = parsed.plans
      lastUpdated.value = parsed.updatedAt
    }
    load()
  })

  return { plans: data, activePlan, loading, error, lastUpdated, load }
})
