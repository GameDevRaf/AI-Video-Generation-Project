<template>
  <div class="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
    <div class="w-full max-w-sm flex flex-col gap-6">
      <div class="flex flex-col gap-1.5 text-center">
        <h1 class="text-2xl font-semibold">Welcome back</h1>
        <p class="text-sm text-gray-400">Log in to your account</p>
      </div>

      <form class="flex flex-col gap-4" onsubmit="return false;" @submit.prevent="login">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-gray-300" for="email">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            placeholder="you@example.com"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-gray-300" for="password">Password</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            placeholder="••••••••"
          />
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 bg-white text-gray-950 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {{ loading ? 'Logging in…' : 'Log in' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-400">
        No account?
        <NuxtLink to="/auth/signup" class="text-white hover:underline">Sign up</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Sign In — VideoAI' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')

async function login() {
  loading.value = true
  error.value = ''
  const { error: err } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  })
  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    router.push('/dashboard')
  }
}
</script>
