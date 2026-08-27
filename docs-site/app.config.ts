export default defineAppConfig({
  docus: {
    locale: 'en',
    colorMode: 'dark',
  },
  github: {
    url: 'https://github.com/GameDevRaf/AI-Video-Generation-Project',
    branch: 'master',
    rootDir: 'docs-site',
  },
  header: {
    title: 'AI Video Generation Project',
  },
  navigation: {
    sub: 'header',
  },
  search: {
    fts: true,
  },
  seo: {
    title: 'AI Video Generation Project Docs',
    description: 'Developer documentation for the AI Video Generation Project.',
  },
  socials: {
    github: {
      label: 'GitHub',
      icon: 'i-simple-icons-github',
      to: 'https://github.com/GameDevRaf/AI-Video-Generation-Project',
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
