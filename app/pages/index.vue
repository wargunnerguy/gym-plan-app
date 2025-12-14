<script setup lang="ts">
const planStore = usePlanStore()

const currentPlan = computed(() => planStore.activePlan)
const currentPhase = computed(() => currentPlan.value?.phases[0])

const weekOptions = computed(() =>
  (currentPhase.value?.weeks || []).map((week) => ({
    label: `Week ${week.week}`,
    value: week.week
  }))
)

const selectedWeek = ref<number | null>(null)

watch(
  () => weekOptions.value,
  (weeks) => {
    if (!weeks.length) {
      selectedWeek.value = null
      return
    }
    if (!selectedWeek.value || !weeks.find((w) => w.value === selectedWeek.value)) {
      selectedWeek.value = weeks[0].value
    }
  },
  { immediate: true }
)

const weekData = computed(() =>
  currentPhase.value?.weeks.find((week) => week.week === selectedWeek.value) || null
)

const workouts = computed(() => weekData.value?.workouts || [])
</script>

<template>
  <UContainer class="space-y-6 py-6">
    <header class="space-y-2">
      <p class="text-sm uppercase tracking-wide text-muted">Plan</p>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-semibold">
          {{ currentPlan?.name || 'Loading plan' }}
        </h1>
        <UBadge v-if="currentPhase" color="primary" variant="solid">
          {{ currentPhase.name }}
        </UBadge>
        <UBadge v-if="planStore.lastUpdated" color="neutral" variant="outline">
          Updated {{ new Date(planStore.lastUpdated).toLocaleDateString() }}
        </UBadge>
      </div>
      <p class="text-muted">
        View your weekly workouts, including supersets, subs, and notes. Data is cached offline.
      </p>
    </header>

    <div v-if="planStore.error" class="rounded-lg border border-amber-400/60 bg-amber-50/60 px-4 py-3 text-amber-900 dark:border-amber-300/60 dark:bg-amber-900/20 dark:text-amber-100">
      {{ planStore.error }}
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <USelect
        v-if="weekOptions.length"
        v-model="selectedWeek"
        :options="weekOptions"
        placeholder="Pick a week"
        class="w-40"
      />
      <UBadge v-if="workouts.length" color="primary" variant="soft">
        {{ workouts.length }} workout{{ workouts.length === 1 ? '' : 's' }} this week
      </UBadge>
    </div>

    <div v-if="planStore.loading" class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <USkeleton v-for="n in 4" :key="n" class="h-32" />
    </div>

    <div v-else-if="!workouts.length" class="rounded-lg border border-dashed border-muted/60 px-4 py-6 text-muted">
      No workouts found for this week.
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <UCard v-for="workout in workouts" :key="workout.id" class="flex flex-col gap-3">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <p class="text-xs uppercase tracking-wide text-muted">Day {{ workout.order }}</p>
            <h2 class="text-xl font-semibold">{{ workout.dayName }}</h2>
            <UBadge color="primary" variant="soft">{{ workout.focus }}</UBadge>
          </div>
          <UBadge v-if="workout.exercises.length" color="neutral" variant="outline">
            {{ workout.exercises.length }} moves
          </UBadge>
        </div>

        <div class="space-y-2">
          <div
            v-for="exercise in workout.exercises"
            :key="exercise.id"
            class="rounded-lg border border-muted/50 bg-muted/5 px-3 py-2"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-sm font-medium">{{ exercise.name }}</span>
              <UBadge v-if="exercise.group" color="primary" variant="soft">
                {{ exercise.group }}
              </UBadge>
              <UBadge color="neutral" variant="soft">
                {{ exercise.reps }} reps
              </UBadge>
              <UBadge color="neutral" variant="soft">
                {{ exercise.workingSets }} working sets<span v-if="exercise.warmupSets"> · {{ exercise.warmupSets }} warm-up</span>
              </UBadge>
              <UBadge color="neutral" variant="outline">
                RPE {{ exercise.rpe }}
              </UBadge>
            </div>
            <p v-if="exercise.notes" class="text-sm text-muted">
              {{ exercise.notes }}
            </p>
            <div v-if="exercise.subs?.length" class="flex flex-wrap gap-2 pt-1">
              <UBadge v-for="(sub, idx) in exercise.subs" :key="idx" color="primary" variant="ghost">
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
