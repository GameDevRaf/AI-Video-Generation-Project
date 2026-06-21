<template>
  <div class="min-h-screen bg-gray-950 text-white flex">
    <!-- Sidebar -->
    <aside class="w-56 shrink-0 border-r border-white/10 flex flex-col">
      <div class="px-5 py-4 border-b border-white/10">
        <span class="text-base font-semibold tracking-tight">VideoAI</span>
      </div>
      <nav class="flex flex-col gap-1 p-3 flex-1">
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          active-class="text-white bg-white/8"
        >
          Projects
        </NuxtLink>
        <NuxtLink
          to="/settings"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          active-class="text-white bg-white/8"
        >
          Settings
        </NuxtLink>
      </nav>
      <div class="p-3 border-t border-white/10">
        <button
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          @click="logout"
        >
          Log out
        </button>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

async function logout() {
  await supabase.auth.signOut()
  router.push('/auth/login')
}
</script>
