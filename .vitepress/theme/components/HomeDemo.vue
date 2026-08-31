<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import androidDemo from '../../../docs/assets/capacitor-oidc-demo-android.mp4';
import iosDemo from '../../../docs/assets/capacitor-oidc-demo-ios.mp4';
import webDemo from '../../../docs/assets/capacitor-oidc-demo-web.mp4';

const demos = [
  { id: 'ios', label: 'iOS', src: iosDemo, duration: 18_267 },
  { id: 'android', label: 'Android', src: androidDemo, duration: 8_509 },
  { id: 'web', label: 'Web', src: webDemo, duration: 8_833 },
];

const activeIndex = ref(0);
const userPaused = ref(true);
const interactionPaused = ref(false);
const reduceMotion = ref(true);
const video = ref<HTMLVideoElement>();
const activeDemo = computed(() => demos[activeIndex.value]);
const paused = computed(() => userPaused.value || interactionPaused.value);

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion.value) void nextTick(resume);
});

function selectDemo(index: number): void {
  activeIndex.value = index;
  void nextTick(() => {
    if (!reduceMotion.value && !paused.value) void video.value?.play();
  });
}

function advance(): void {
  if (paused.value) return;
  if (reduceMotion.value) {
    userPaused.value = true;
    return;
  }

  selectDemo((activeIndex.value + 1) % demos.length);
}

function pause(): void {
  userPaused.value = true;
  video.value?.pause();
}

function resume(): void {
  if (reduceMotion.value) return;
  userPaused.value = false;
  if (!interactionPaused.value) void video.value?.play();
}

function suspend(): void {
  interactionPaused.value = true;
  video.value?.pause();
}

function unsuspend(): void {
  interactionPaused.value = false;
  if (!userPaused.value && !reduceMotion.value) void video.value?.play();
}

function togglePlayback(): void {
  if (!userPaused.value) {
    pause();
    return;
  }

  resume();
}

function selectAndResume(index: number): void {
  selectDemo(index);
  if (reduceMotion.value) {
    pause();
    return;
  }

  resume();
}

function navigateTabs(event: KeyboardEvent, index: number): void {
  const nextIndex = {
    ArrowLeft: (index - 1 + demos.length) % demos.length,
    ArrowRight: (index + 1) % demos.length,
    Home: 0,
    End: demos.length - 1,
  }[event.key];

  if (nextIndex === undefined) return;

  event.preventDefault();
  selectDemo(nextIndex);
  const tabs = (event.currentTarget as HTMLButtonElement).parentElement!.querySelectorAll<HTMLButtonElement>(
    '[role="tab"]',
  );
  tabs[nextIndex].focus();
}
</script>

<template>
  <section class="HomeDemo" aria-labelledby="home-demo-title">
    <header class="HomeDemo-header">
      <p class="HomeDemo-eyebrow">See it in action</p>
      <h2 id="home-demo-title">One flow on every platform</h2>
      <p>Sign in, renew the session, and sign out with the same manager on iOS, Android, and the web.</p>
    </header>

    <div class="HomeDemo-player" :class="{ 'is-paused': paused }">
      <div
        class="HomeDemo-tabs"
        role="tablist"
        aria-label="Demo platform"
        @focusin="suspend"
        @focusout="unsuspend"
        @mouseenter="suspend"
        @mouseleave="unsuspend"
      >
        <button
          v-for="(demo, index) in demos"
          :id="`home-demo-tab-${demo.id}`"
          :key="demo.id"
          type="button"
          role="tab"
          :aria-controls="`home-demo-panel-${demo.id}`"
          :aria-selected="activeIndex === index"
          :tabindex="activeIndex === index ? 0 : -1"
          :class="{ 'is-active': activeIndex === index }"
          @click="selectAndResume(index)"
          @keydown="navigateTabs($event, index)"
        >
          {{ demo.label }}
          <span class="HomeDemo-tab-progress" aria-hidden="true">
            <span :style="{ '--demo-duration': `${demo.duration}ms` }"></span>
          </span>
        </button>
      </div>

      <div
        :id="`home-demo-panel-${activeDemo.id}`"
        class="HomeDemo-stage"
        :class="`is-${activeDemo.id}`"
        role="tabpanel"
        :aria-labelledby="`home-demo-tab-${activeDemo.id}`"
      >
        <Transition name="HomeDemo-media" mode="out-in">
          <video
            :key="activeDemo.id"
            ref="video"
            :src="activeDemo.src"
            :autoplay="!reduceMotion && !paused"
            muted
            playsinline
            preload="metadata"
            @ended="advance"
          ></video>
        </Transition>
        <button
          class="HomeDemo-playback"
          type="button"
          :aria-label="paused ? 'Play demo' : 'Pause demo'"
          @click="togglePlayback"
        >
          {{ paused ? 'Play' : 'Pause' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.HomeDemo {
  max-width: 1152px;
  margin: 0 auto;
  padding: 96px 24px 32px;
}

.HomeDemo-header {
  max-width: 680px;
  margin: 0 auto 32px;
  text-align: center;
}

.HomeDemo-eyebrow {
  margin: 0 0 8px;
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.HomeDemo h2 {
  margin: 0;
  color: var(--vp-c-text-1);
  font-size: clamp(30px, 5vw, 44px);
  letter-spacing: -0.035em;
  line-height: 1.1;
  text-wrap: balance;
}

.HomeDemo-header > p:last-child {
  margin: 16px auto 0;
  color: var(--vp-c-text-2);
  font-size: 18px;
  line-height: 1.6;
  text-wrap: pretty;
}

.HomeDemo-player {
  padding: 12px;
  border-radius: 24px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--capacitor-oidc-card-shadow);
}

.HomeDemo-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 4px;
  border-radius: 14px;
  background: var(--vp-c-bg);
  gap: 4px;
}

.HomeDemo-tabs button {
  position: relative;
  overflow: hidden;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  color: var(--vp-c-text-2);
  background: transparent;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition-property: color, background-color, box-shadow, transform;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.HomeDemo-tab-progress {
  position: absolute;
  right: 10px;
  bottom: 4px;
  left: 10px;
  height: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--vp-c-divider);
}

.HomeDemo-tab-progress span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: var(--vp-c-brand-1);
}

.HomeDemo-tabs button.is-active .HomeDemo-tab-progress span {
  animation: HomeDemo-progress var(--demo-duration) linear forwards;
}

.HomeDemo-player.is-paused .HomeDemo-tabs button.is-active .HomeDemo-tab-progress span {
  animation-play-state: paused;
}

.HomeDemo-tabs button[aria-selected='true'] {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  box-shadow: var(--capacitor-oidc-card-shadow);
}

@media (hover: hover) {
  .HomeDemo-tabs button:not([aria-selected='true']):hover {
    color: var(--vp-c-text-1);
    background: var(--vp-c-bg-soft);
  }
}

.HomeDemo-tabs button:active {
  transform: scale(0.96);
}

.HomeDemo-stage {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 16 / 9;
  margin-top: 12px;
  overflow: hidden;
  border-radius: 14px;
  background: #0d0d0d;
}

.HomeDemo-stage video {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  outline: 1px solid rgb(255 255 255 / 10%);
  outline-offset: -1px;
}

.HomeDemo-playback {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1;
  min-width: 64px;
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: var(--capacitor-oidc-card-shadow);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition-property: color, background-color, transform;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.HomeDemo-playback:hover {
  color: var(--vp-c-brand-1);
}

.HomeDemo-playback:active {
  transform: scale(0.96);
}

.HomeDemo-media-enter-active,
.HomeDemo-media-leave-active {
  transition-property: opacity, transform, filter;
  transition-duration: 180ms;
}

.HomeDemo-media-enter-active {
  transition-timing-function: ease-out;
}

.HomeDemo-media-leave-active {
  transition-timing-function: ease-in;
}

.HomeDemo-media-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(8px);
}

.HomeDemo-media-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(-8px);
}

@keyframes HomeDemo-progress {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

@media (max-width: 639px) {
  .HomeDemo {
    padding: 72px 24px 24px;
  }

  .HomeDemo-header {
    margin-bottom: 24px;
  }

  .HomeDemo-header > p:last-child {
    font-size: 16px;
  }

  .HomeDemo-player {
    margin: 0 -12px;
    padding: 8px;
    border-radius: 20px;
  }

  .HomeDemo-stage {
    aspect-ratio: 4 / 3;
    margin-top: 8px;
    border-radius: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .HomeDemo-media-enter-active,
  .HomeDemo-media-leave-active {
    transition: none;
  }

  .HomeDemo-tabs button.is-active .HomeDemo-tab-progress span {
    animation: none;
  }
}
</style>
