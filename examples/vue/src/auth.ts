import { CapacitorUserManager } from 'capacitor-oidc';

const authority = import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/capacitor-oidc-e2e';
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID ?? 'capacitor-oidc-example';

const manager = CapacitorUserManager.create({
  common: {
    authority,
    client_id: clientId,
    scope: 'openid profile offline_access',
    automaticSilentRenew: false,
    loadUserInfo: true,
    revokeTokensOnSignout: true,
  },
  web: {
    settings: {
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: `${window.location.origin}/logout-callback`,
    },
  },
  native: {
    settings: {
      redirect_uri: 'capacitor-oidc-example:/callback',
      post_logout_redirect_uri: 'capacitor-oidc-example:/logout-callback',
    },
    options: { storageNamespace: 'vue-example' },
  },
});

export function getUserManager() {
  return manager;
}
