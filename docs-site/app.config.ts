export default defineAppConfig({
  docus: {
    locale: 'en',
    colorMode: 'dark',
  },
  header: {
    title: 'AI Video Docs',
  },
  navigation: {
    sub: 'header',
  },
  search: {
    fts: true,
  },
  seo: {
    title: 'AI Video Generation Docs',
    description: 'Developer documentation for the AI Video Generation Project.',
  },
  socials: {
    github: {
      label: 'GitHub',
      icon: 'i-simple-icons-github',
      to: 'https://github.com/',
    },
  },
  toc: {
    title: 'On this page',
  },
  ui: {
    colors: {
      primary: 'indigo',
      neutral: 'slate',
    },
  },
})
