<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import type { CapacitorUserManager, User } from 'capacitor-oidc';

import { getUserManager } from './auth';

const auth = shallowRef<CapacitorUserManager>();
const user = shallowRef<User | null>(null);
const busy = ref(false);
const message = ref('Restoring the stored session…');
const displayName = computed(
  () => user.value?.profile.preferred_username ?? user.value?.profile.name ?? user.value?.profile.sub,
);

function report(error: unknown) {
  message.value = error instanceof Error ? error.message : String(error);
  busy.value = false;
}

function run(label: string, action: () => Promise<void>) {
  busy.value = true;
  message.value = label;
  void action()
    .catch(report)
    .finally(() => {
      busy.value = false;
    });
}

function signin() {
  const manager = auth.value;
  if (manager) run('Opening the identity provider…', () => manager.signin());
}

function renew() {
  const manager = auth.value;
  if (!manager) return;

  run('Renewing the session…', async () => {
    user.value = await manager.getValidUser(60);
    message.value = user.value ? 'The access token is ready.' : 'No renewable session was found.';
  });
}

function signout() {
  const manager = auth.value;
  if (manager) run('Signing out at the identity provider…', () => manager.signout());
}

onMounted(() => {
  void getUserManager()
    .then(async (manager) => {
      auth.value = manager;
      manager.events.addUserLoaded((loadedUser) => {
        user.value = loadedUser;
        message.value = 'The session was stored.';
      });
      manager.events.addUserUnloaded(() => {
        user.value = null;
        message.value = 'The session was cleared.';
      });

      if (window.location.pathname === '/callback') {
        await manager.signinCallback();
        window.history.replaceState({}, '', '/');
      } else if (window.location.pathname === '/logout-callback') {
        await manager.signoutCallback();
        window.history.replaceState({}, '', '/');
      }

      user.value = await manager.getUser();
      message.value = user.value ? 'The stored session is ready.' : 'No local session is stored.';
    })
    .catch(report);
});
</script>

<template>
  <main>
    <section class="card" aria-labelledby="title">
      <p class="eyebrow">Vue + Capacitor</p>
      <h1 id="title">OpenID Connect, one manager</h1>
      <p class="summary">The same session API runs in the browser and in the native Capacitor shell.</p>

      <div class="session" aria-live="polite">
        <span class="status-dot" :class="{ active: user }" aria-hidden="true"></span>
        <div>
          <strong>{{ user ? `Signed in as ${displayName}` : 'Signed out' }}</strong>
          <p>{{ message }}</p>
        </div>
      </div>

      <div class="actions">
        <button :disabled="busy || !auth || Boolean(user)" @click="signin">Sign in</button>
        <button class="secondary" :disabled="busy || !user" @click="renew">Renew</button>
        <button class="secondary" :disabled="busy || !user" @click="signout">Sign out</button>
      </div>
    </section>
  </main>
</template>
