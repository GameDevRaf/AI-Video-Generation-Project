import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

const supabaseServerAlias = resolve(process.cwd(), 'supabase-server.ts')

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  alias: {
    '#supabase/server': supabaseServerAlias,
  },

  modules: [
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    resolve: {
      alias: {
        '#supabase/server': supabaseServerAlias,
      },
    },
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },

  nitro: {
    alias: {
      '#supabase/server': supabaseServerAlias,
    },
  },

  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  },

  supabase: {
    redirectOptions: {
      login: '/auth/login',
      callback: '/confirm',
      exclude: ['/', '/auth/login', '/auth/signup', '/confirm'],
    },
    types: '~/types/database.types',
  },
})
