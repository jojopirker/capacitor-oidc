import { CapacitorUserManager } from 'capacitor-oidc';
import type { User } from 'oidc-client-ts';

import './style.css';

const state = document.querySelector<HTMLParagraphElement>('#state')!;
const detail = document.querySelector<HTMLParagraphElement>('#detail')!;
const event = document.querySelector<HTMLParagraphElement>('#event')!;
const dot = document.querySelector<HTMLSpanElement>('#dot')!;
const signin = document.querySelector<HTMLButtonElement>('#signin')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const signout = document.querySelector<HTMLButtonElement>('#signout')!;

const manager = await CapacitorUserManager.create(
  {
    authority: 'https://localhost:8443/realms/capacitor-oidc-e2e',
    client_id: 'capacitor-oidc-example',
    redirect_uri: 'capacitor-oidc-example:/callback',
    post_logout_redirect_uri: 'capacitor-oidc-example:/logout-callback',
    scope: 'openid profile',
    automaticSilentRenew: false,
    loadUserInfo: true,
    revokeTokensOnSignout: true,
  },
  {
    storageNamespace: 'example',
  },
);

function render(user: User | null): void {
  const signedIn = Boolean(user);
  state.textContent = signedIn
    ? `Hello, ${user?.profile.preferred_username ?? user?.profile.name ?? 'user'}`
    : 'Signed out';
  detail.textContent = signedIn
    ? `Session secured · expires in ${Math.max(0, Math.round(user?.expires_in ?? 0))} seconds`
    : 'No local session is stored';
  dot.classList.toggle('active', signedIn);
  signin.disabled = signedIn;
  refresh.disabled = !signedIn;
  signout.disabled = !signedIn;
}

function report(error: unknown): void {
  event.textContent = `Authentication failed: ${error instanceof Error ? error.message : String(error)}`;
}

async function run(label: string, action: () => Promise<User | null | void>): Promise<void> {
  event.textContent = label;
  const user = await action();
  render(user === undefined ? await manager.getUser() : user);
}

async function renew(): Promise<void> {
  event.textContent = 'Renewing through the refresh token…';
  render(await manager.getValidUser(60));
  event.textContent = 'Session renewed through the refresh token';
}

manager.events.addUserLoaded((user) => {
  event.textContent = 'Session loaded and stored securely';
  render(user);
});
manager.events.addUserUnloaded(() => {
  event.textContent = 'Provider and local session cleared';
  render(null);
});
manager.events.addSilentRenewError((error) => {
  event.textContent = `Renewal failed: ${error.message}`;
});

signin.addEventListener('click', () => {
  void run('Opening the native authentication session…', () => manager.signin()).catch(report);
});
refresh.addEventListener('click', () => void renew().catch(report));
signout.addEventListener('click', () => {
  void run('Opening provider logout…', () => manager.signout()).catch(report);
});

render(await manager.getUser());
