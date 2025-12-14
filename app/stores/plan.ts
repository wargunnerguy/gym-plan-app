import type { NormalizedPlan } from '@/server/utils/transformPlan'

type PlanResponse = { updatedAt: string } & NormalizedPlan

export const usePlanStore = defineStore('plan', () => {
  const data = ref<NormalizedPlan['plans']>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<string | null>(null)

  const activePlan = computed(() => data.value.find(plan => plan.active) || data.value[0])

  const load = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await $fetch<PlanResponse>('/plan.json', { cache: 'no-cache' })
      data.value = response.plans
      lastUpdated.value = response.updatedAt
      if (import.meta.client) {
        localStorage.setItem('plan-cache', JSON.stringify(response))
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load plan'
      if (import.meta.client) {
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
    const cached = import.meta.client ? localStorage.getItem('plan-cache') : null
    if (cached) {
      const parsed = JSON.parse(cached) as PlanResponse
      data.value = parsed.plans
      lastUpdated.value = parsed.updatedAt
    }
    load()
  })

  return { plans: data, activePlan, loading, error, lastUpdated, load }
})
