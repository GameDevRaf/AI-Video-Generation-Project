<template>
  <div class="min-h-screen bg-gray-950 text-white flex items-center justify-center">
    <p class="text-gray-400 text-sm">Confirming your account…</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const router = useRouter()

onMounted(() => {
  router.push('/dashboard')
})
</script>
