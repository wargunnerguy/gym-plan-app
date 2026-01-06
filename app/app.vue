<script setup>
import { usePlanStore } from '@/stores/plan'

const title = 'Reimo\'s Gym'
const description = 'Offline-friendly viewer for your Google Sheets workout plans.'
const settingsOpen = useState('settingsOpen', () => false)
const selectedPhaseId = useState('selectedPhaseId', () => null)
const selectedWeek = useState('selectedWeek', () => null)

const planStore = usePlanStore()
const currentPlan = computed(() => planStore.activePlan)
const phases = computed(() => currentPlan.value?.phases || [])
const currentPhase = computed(() => {
  if (!phases.value.length) return null
  return phases.value.find(p => p.id === selectedPhaseId.value) || phases.value[0]
})
const currentPhaseIndex = computed(() => {
  if (!phases.value.length || !currentPhase.value) return null
  return phases.value.findIndex(p => p.id === currentPhase.value?.id)
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary',
  themeColor: '#0f172a'
})

onMounted(() => {
  if (!planStore.plans.length) {
    planStore.load().catch(() => {})
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          class="flex items-center gap-2 font-semibold"
        >
          <UIcon
            name="i-lucide-dumbbell"
            class="h-5 w-5"
          />
          <span>Reimo&apos;s Gym</span>
        </NuxtLink>
      </template>

      <template #right>
        <UButton
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-settings"
          @click="settingsOpen = true"
        />
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
