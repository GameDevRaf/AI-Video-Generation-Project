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
    title: 'Vira',
  },
  navigation: {
    sub: 'header',
  },
  search: {
    fts: true,
  },
  seo: {
    title: 'Vira Docs',
    description: 'Developer documentation for Vira.',
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
