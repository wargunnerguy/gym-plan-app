<script setup lang="ts">
const planStore = usePlanStore()
const progressStore = useProgressStore()

const currentPlan = computed(() => planStore.activePlan)

const phaseOptions = computed(() =>
  (currentPlan.value?.phases || []).map(phase => ({
    label: phase.name,
    value: phase.id
  }))
)
const phases = computed(() => currentPlan.value?.phases || [])

const selectedPhaseId = ref<string | null>(null)

watch(
  () => phaseOptions.value,
  (phases) => {
    if (!phases.length) {
      selectedPhaseId.value = null
      return
    }
    if (!selectedPhaseId.value || !phases.find(p => p.value === selectedPhaseId.value)) {
      selectedPhaseId.value = phases[0].value
    }
  },
  { immediate: true }
)

const currentPhase = computed(() => {
  const phases = currentPlan.value?.phases || []
  if (!phases.length) return null
  return phases.find(p => p.id === selectedPhaseId.value) || phases[0]
})

onMounted(async () => {
  // Ensure data is loaded even if store onMounted didn't run (SSR/hydration edge)
  if (!planStore.plans.length) {
    await planStore.load()
  }
  if (import.meta.client) {
    console.info('[plan] phases', currentPlan.value?.phases?.length || 0, 'weeks', currentPhase.value?.weeks?.length || 0)
  }
})

const weekOptions = computed(() =>
  (currentPhase.value?.weeks || []).map(week => ({
    label: `Week ${week.week}`,
    value: week.week
  }))
)
const weeks = computed(() => currentPhase.value?.weeks || [])

const selectedWeek = ref<number | null>(null)
const hideCompleted = ref(true)

const pickInitialWeek = () => {
  const weeks = weekOptions.value
  if (!weeks.length) {
    selectedWeek.value = null
    return
  }
  const phaseId = currentPhase.value?.id
  if (!phaseId) {
    selectedWeek.value = weeks[0].value
    return
  }
  const firstWithWorkLeft = currentPhase.value?.weeks.find(week =>
    week.workouts.some(w => !progressStore.isCompleted(phaseId, week.week, w.id))
  )
  selectedWeek.value = (firstWithWorkLeft?.week ?? weeks[0].value)
}

watch(
  () => [weekOptions.value, selectedPhaseId.value, planStore.plans.length],
  () => pickInitialWeek(),
  { immediate: true }
)

const weekData = computed(() =>
  currentPhase.value?.weeks.find(week => week.week === selectedWeek.value) || null
)

const workouts = computed(() => weekData.value?.workouts || [])

const visibleWorkouts = computed(() => {
  if (!workouts.value) return []
  if (!hideCompleted.value) return workouts.value
  const phaseId = currentPhase.value?.id
  if (!phaseId) return workouts.value
  return workouts.value.filter(w => !progressStore.isCompleted(phaseId, weekData.value?.week || 0, w.id))
})

const nextWorkout = computed(() => {
  const phaseId = currentPhase.value?.id
  if (!phaseId || !weekData.value) return null
  const notDone = weekData.value.workouts.find(w => !progressStore.isCompleted(phaseId, weekData.value!.week, w.id))
  return notDone || weekData.value.workouts[0] || null
})
</script>

<template>
  <UContainer class="space-y-6 py-6">
    <header class="space-y-2">
      <p class="text-sm uppercase tracking-wide text-muted">
        Plan
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-semibold">
          {{ currentPlan?.name || 'Loading plan' }}
        </h1>
        <UBadge
          v-if="currentPhase"
          color="primary"
          variant="solid"
        >
          {{ currentPhase.name }}
        </UBadge>
        <UBadge
          v-if="planStore.lastUpdated"
          color="neutral"
          variant="outline"
        >
          Updated {{ new Date(planStore.lastUpdated).toLocaleDateString() }}
        </UBadge>
      </div>
      <p class="text-muted">
        View your weekly workouts, including supersets, subs, and notes. Data is cached offline.
      </p>
    </header>

    <div
      v-if="planStore.error"
      class="rounded-lg border border-amber-400/60 bg-amber-50/60 px-4 py-3 text-amber-900 dark:border-amber-300/60 dark:bg-amber-900/20 dark:text-amber-100"
    >
      {{ planStore.error }}
    </div>

    <div class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-muted">
          Phase
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="phase in phases"
            :key="phase.id"
            size="xs"
            :color="phase.id === selectedPhaseId ? 'primary' : 'neutral'"
            variant="soft"
            @click="selectedPhaseId = phase.id"
          >
            {{ phase.name }}
          </UButton>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <p class="text-xs uppercase tracking-wide text-muted">
          Week
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="week in weeks"
            :key="week.week"
            size="xs"
            :color="week.week === selectedWeek ? 'primary' : 'neutral'"
            variant="ghost"
            @click="selectedWeek = week.week"
          >
            Week {{ week.week }}
          </UButton>
        </div>
        <UBadge
          v-if="workouts.length"
          color="primary"
          variant="soft"
        >
          {{ workouts.length }} workout{{ workouts.length === 1 ? '' : 's' }} this week
        </UBadge>
        <UCheckbox
          v-model="hideCompleted"
          label="Hide completed"
        />
      </div>
    </div>

    <div
      v-if="nextWorkout"
      class="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <p class="text-xs uppercase tracking-wide text-primary">
        Next up
      </p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-lg font-semibold">{{ nextWorkout.dayName }}</span>
        <UBadge
          color="primary"
          variant="solid"
        >
          {{ nextWorkout.focus }}
        </UBadge>
        <UBadge
          color="neutral"
          variant="soft"
        >
          {{ nextWorkout.exercises.length }} moves
        </UBadge>
      </div>
    </div>

    <div
      v-if="planStore.loading"
      class="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <USkeleton
        v-for="n in 4"
        :key="n"
        class="h-32"
      />
    </div>

    <div
      v-else-if="!visibleWorkouts.length"
      class="rounded-lg border border-dashed border-muted/60 px-4 py-6 text-muted"
    >
      No workouts found for this week.
    </div>

    <div
      v-else
      class="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <UCard
        v-for="workout in visibleWorkouts"
        :key="workout.id"
        class="flex flex-col gap-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">
              Day {{ workout.order }}
            </p>
            <h2 class="text-xl font-semibold">
              {{ workout.dayName }}
            </h2>
            <UBadge
              color="primary"
              variant="soft"
            >
              {{ workout.focus }}
            </UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UBadge
              v-if="workout.exercises.length"
              color="neutral"
              variant="outline"
            >
              {{ workout.exercises.length }} moves
            </UBadge>
            <UButton
              size="xs"
              :color="progressStore.isCompleted(currentPhase?.id || '', weekData?.week || 0, workout.id) ? 'primary' : 'neutral'"
              variant="soft"
              @click="progressStore.toggleCompletion(currentPhase?.id || '', weekData?.week || 0, workout.id)"
            >
              <span v-if="progressStore.isCompleted(currentPhase?.id || '', weekData?.week || 0, workout.id)">Completed</span>
              <span v-else>Mark done</span>
            </UButton>
          </div>
        </div>

        <div class="space-y-2">
          <div
            v-for="exercise in workout.exercises"
            :key="exercise.id"
            class="rounded-lg border border-muted/50 bg-muted/5 px-3 py-2"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium">{{ exercise.name }}</span>
              <UBadge
                v-if="exercise.group"
                color="primary"
                variant="soft"
              >
                {{ exercise.group }}
              </UBadge>
              <UBadge
                color="neutral"
                variant="soft"
              >
                {{ exercise.reps }} reps
              </UBadge>
              <UBadge
                color="neutral"
                variant="soft"
              >
                {{ exercise.workingSets }} working sets<span v-if="exercise.warmupSets"> · {{ exercise.warmupSets }} warm-up</span>
              </UBadge>
              <UBadge
                color="neutral"
                variant="outline"
              >
                RPE {{ exercise.rpe }}
              </UBadge>
            </div>
            <p
              v-if="exercise.notes"
              class="text-sm text-muted"
            >
              {{ exercise.notes }}
            </p>
            <div
              v-if="exercise.subs?.length"
              class="flex flex-wrap gap-2 pt-1"
            >
              <UBadge
                v-for="(sub, idx) in exercise.subs"
                :key="idx"
                color="primary"
                variant="ghost"
              >
                Sub: {{ sub }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              Rest {{ exercise.rest }}
            </p>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
