<template>
  <div class="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
    <div class="w-full max-w-sm flex flex-col gap-6">
      <div class="flex flex-col gap-1.5 text-center">
        <h1 class="text-2xl font-semibold">Create an account</h1>
        <p class="text-sm text-gray-400">Start making videos with AI</p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="signup">
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
            autocomplete="new-password"
            minlength="8"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            placeholder="At least 8 characters"
          />
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
        <p v-if="success" class="text-sm text-green-400">{{ success }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-2.5 bg-white text-gray-950 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-400">
        Already have an account?
        <NuxtLink to="/auth/login" class="text-white hover:underline">Log in</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Sign Up — VideoAI' })

const supabase = useSupabaseClient()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

async function signup() {
  loading.value = true
  error.value = ''
  success.value = ''

  const { error: err } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
  })

  loading.value = false
  if (err) {
    error.value = err.message
  } else {
    success.value = 'Check your email for a confirmation link.'
  }
}
</script>
