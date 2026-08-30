import { defineConfig } from 'vitepress';

const repository = 'https://github.com/jojopirker/capacitor-oidc';
const base = '/capacitor-oidc/';

export default defineConfig({
  title: 'capacitor-oidc',
  description: 'Native OAuth 2.0 and OpenID Connect for Capacitor on iOS and Android.',
  lang: 'en-US',
  base,
  head: [['link', { rel: 'icon', type: 'image/png', href: `${base}logo.png` }]],
  appearance: 'force-auto',
  cleanUrls: true,
  lastUpdated: true,
  srcDir: '.',
  srcExclude: [
    'node_modules/**',
    'dist/**',
    'example/node_modules/**',
    'example/dist/**',
    'examples/**/node_modules/**',
    'examples/**/dist/**',
  ],
  ignoreDeadLinks: ['./LICENSE'],
  rewrites: {
    'README.md': 'index.md',
    'docs/README.md': 'docs/index.md',
    'example/README.md': 'example/index.md',
    'examples/vue/README.md': 'examples/vue/index.md',
    'examples/react/README.md': 'examples/react/index.md',
  },
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark-default',
    },
  },
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Docs', link: '/docs/GETTING_STARTED' },
      { text: 'API', link: '/docs/API' },
      { text: 'Troubleshooting', link: '/docs/TROUBLESHOOTING' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting started', link: '/docs/GETTING_STARTED' },
        ],
      },
      {
        text: 'Setup',
        items: [
          { text: 'iOS and Android', link: '/docs/PLATFORM_SETUP' },
          { text: 'Providers', link: '/docs/PROVIDERS' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Vue', link: '/docs/frameworks/VUE' },
          { text: 'React', link: '/docs/frameworks/REACT' },
          { text: 'Sessions and widgets', link: '/docs/SESSIONS_AND_WIDGETS' },
          { text: 'Security', link: '/SECURITY' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API compatibility', link: '/docs/API' },
          { text: 'Troubleshooting', link: '/docs/TROUBLESHOOTING' },
        ],
      },
    ],
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    search: {
      provider: 'local',
    },
    editLink: {
      pattern: ({ filePath }) => `https://github.com/jojopirker/capacitor-oidc/edit/main/${filePath}`,
      text: 'Edit this page on GitHub',
    },
    socialLinks: [{ icon: 'github', link: repository }],
    lastUpdated: {
      text: 'Last updated',
    },
  },
});
