import { h } from 'vue';
import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import HomeDemo from './components/HomeDemo.vue';
import HomeInstall from './components/HomeInstall.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-actions-after': () => h(HomeInstall),
      'home-features-after': () => h(HomeDemo),
    }),
} satisfies Theme;
