<script setup>
const title = 'Reimo\'s Gym'
const description = 'Offline-friendly viewer for your Google Sheets workout plans.'
const settingsOpen = useState('settingsOpen', () => false)

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
