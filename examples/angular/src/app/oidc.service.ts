import { computed, Injectable, signal } from '@angular/core';
import { CapacitorUserManager, type User } from 'capacitor-oidc';

import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class OidcService {
  readonly user = signal<User | null>(null);
  readonly busy = signal(false);
  readonly ready = signal(false);
  readonly message = signal('Restoring the stored session…');
  readonly displayName = computed(
    () => this.user()?.profile.preferred_username ?? this.user()?.profile.name ?? this.user()?.profile.sub,
  );

  private readonly manager = CapacitorUserManager.create({
    common: {
      authority: environment.authority,
      client_id: environment.clientId,
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
      options: { storageNamespace: 'angular-example' },
    },
  });

  async initialize() {
    const auth = await this.manager;
    this.ready.set(true);
    auth.events.addUserLoaded((loadedUser) => {
      this.user.set(loadedUser);
      this.message.set('The session was stored.');
    });
    auth.events.addUserUnloaded(() => {
      this.user.set(null);
      this.message.set('The session was cleared.');
    });

    if (window.location.pathname === '/callback') {
      await auth.signinCallback();
      window.history.replaceState({}, '', '/');
    } else if (window.location.pathname === '/logout-callback') {
      await auth.signoutCallback();
      window.history.replaceState({}, '', '/');
    }

    const storedUser = await auth.getUser();
    this.user.set(storedUser);
    this.message.set(storedUser ? 'The stored session is ready.' : 'No local session is stored.');
  }

  signin() {
    this.run('Opening the identity provider…', (auth) => auth.signin());
  }

  renew() {
    this.run('Renewing the session…', async (auth) => {
      const renewedUser = await auth.getValidUser(60);
      this.user.set(renewedUser);
      this.message.set(renewedUser ? 'The access token is ready.' : 'No renewable session was found.');
    });
  }

  signout() {
    this.run('Signing out at the identity provider…', (auth) => auth.signout());
  }

  private run(label: string, action: (auth: CapacitorUserManager) => Promise<void>) {
    this.busy.set(true);
    this.message.set(label);
    void this.manager
      .then(action)
      .catch((error: unknown) => {
        this.message.set(error instanceof Error ? error.message : String(error));
      })
      .finally(() => this.busy.set(false));
  }
}
