export default defineNuxtConfig({
  extends: ['docus'],
  modules: ['@barzhsieh/nuxt-content-mermaid'],
  css: ['~~/assets/css/mermaid.css'],
  site: {
    name: 'Vira',
  },
  contentMermaid: {
    enabled: true,
    theme: {
      light: 'default',
      dark: 'dark',
    },
    loader: {
      lazy: true,
      init: {
        startOnLoad: false,
        securityLevel: 'strict',
      },
    },
  },
})
