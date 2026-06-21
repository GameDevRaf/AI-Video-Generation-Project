import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ]
    }
  },

  runtimeConfig: {
    // Server-only — used by the worker to bypass RLS
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },

  supabase: {
    redirectOptions: {
      login: '/auth/login',
      callback: '/confirm',
      // Explicit paths prevent @nuxtjs/supabase from redirecting auth pages on session changes
      exclude: ['/', '/auth/login', '/auth/signup', '/confirm'],
    },
    types: '~/types/database.types',
  },
})
