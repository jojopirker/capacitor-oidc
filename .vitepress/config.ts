import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

const repository = 'https://github.com/jojopirker/capacitor-oidc';
const base = '/capacitor-oidc/';
const site = 'https://jojopirker.github.io/capacitor-oidc/';

export default defineConfig({
  title: 'capacitor-oidc',
  description: 'Native OAuth 2.0 and OpenID Connect for Capacitor on iOS and Android.',
  lang: 'en-US',
  base,
  head: [['link', { rel: 'icon', type: 'image/png', href: `${base}logo.png` }]],
  appearance: 'force-auto',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: site,
  },
  srcDir: '.',
  srcExclude: [
    'README.md',
    'node_modules/**',
    'dist/**',
    'example/node_modules/**',
    'example/dist/**',
    'examples/**/node_modules/**',
    'examples/**/dist/**',
  ],
  ignoreDeadLinks: ['./LICENSE'],
  rewrites: {
    'docs/HOME.md': 'index.md',
    'docs/README.md': 'docs/index.md',
    'example/README.md': 'example/index.md',
    'examples/vue/README.md': 'examples/vue/index.md',
    'examples/react/README.md': 'examples/react/index.md',
    'examples/angular/README.md': 'examples/angular/index.md',
  },
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark-default',
    },
  },
  vite: {
    plugins: [llmstxt()],
  },
  themeConfig: {
    logo: '/logo.png',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/docs/GETTING_STARTED' },
      { text: 'Troubleshooting', link: '/docs/TROUBLESHOOTING' },
      { text: 'GitHub', link: repository },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Documentation', link: '/docs/' },
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
          { text: 'Angular', link: '/docs/frameworks/ANGULAR' },
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
    lastUpdated: {
      text: 'Last updated',
    },
  },
});
