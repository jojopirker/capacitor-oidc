<script setup lang="ts">
import { ref } from 'vue';

const command = 'npm i capacitor-oidc';
const copyLabel = ref('Copy');

function copyCommand(): void {
  void navigator.clipboard.writeText(command).then(
    () => {
      copyLabel.value = 'Copied';
      window.setTimeout(() => (copyLabel.value = 'Copy'), 1600);
    },
    () => (copyLabel.value = 'Retry'),
  );
}
</script>

<template>
  <div class="HomeInstall" aria-label="Install capacitor-oidc">
    <span class="HomeInstall-command">
      <span aria-hidden="true">$</span>
      <code>{{ command }}</code>
    </span>
    <button
      class="HomeInstall-copy"
      type="button"
      :aria-label="`${copyLabel} install command`"
      @click="copyCommand"
    >
      <span class="HomeInstall-copy-icon" aria-hidden="true"></span>
      <span class="HomeInstall-copy-label">{{ copyLabel }}</span>
    </button>
  </div>
</template>

<style scoped>
.HomeInstall {
  display: inline-flex;
  align-items: center;
  margin-top: 18px;
  padding: 6px 6px 6px 14px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  box-shadow: var(--capacitor-oidc-card-shadow);
  gap: 14px;
}

.HomeInstall-command {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  color: var(--vp-c-text-2);
  gap: 8px;
}

.HomeInstall-command code {
  overflow: hidden;
  color: var(--vp-c-text-1);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.HomeInstall-copy {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px 0 10px;
  border-radius: 8px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  font-size: 13px;
  font-weight: 600;
  border: 0;
  font-family: inherit;
  transition-property: color, background-color, transform;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
  cursor: pointer;
  gap: 6px;
}

.HomeInstall-copy:hover {
  color: var(--vp-c-brand-1);
}

.HomeInstall-copy:active {
  transform: scale(0.96);
}

.HomeInstall-copy-icon {
  width: 18px;
  height: 18px;
  background: currentColor;
  mask: url('../../../node_modules/lucide-static/icons/copy.svg') center / contain no-repeat;
}

@media (max-width: 639px) {
  .HomeInstall {
    display: flex;
    width: 100%;
    margin-top: 14px;
    gap: 6px;
  }

  .HomeInstall-command {
    flex: 1;
  }

  .HomeInstall-command code {
    font-size: 11px;
  }

  .HomeInstall-copy {
    width: 40px;
    padding: 0;
    justify-content: center;
  }

  .HomeInstall-copy-label {
    display: none;
  }
}
</style>
