import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  ErrorResponse,
  type QuerySessionStatusArgs,
  type SessionStatus,
  type SigninRedirectArgs,
  type SigninSilentArgs,
  type SignoutRedirectArgs,
  type SignoutResponse,
  type SignoutSilentArgs,
  type User,
} from 'oidc-client-ts';

import { CapacitorUserManager } from './base-capacitor-user-manager.js';
import { CapacitorNavigator, UnsupportedIframeNavigator } from './capacitor-navigator.js';
import { CapacitorSecureStateStore } from './capacitor-secure-state-store.js';
import type { ResolvedUserManagerConfiguration } from './configuration.js';
import type { StoredSessionV1 } from './definitions.js';
import { unsupported } from './errors.js';
import { NativeOidc } from './native.js';

export class NativeCapacitorUserManager extends CapacitorUserManager {
  private appStateListener?: PluginListenerHandle;
  private readonly storageNamespace: string;

  private constructor(configuration: ResolvedUserManagerConfiguration) {
    const storageNamespace = configuration.nativeOptions?.storageNamespace ?? 'default';
    const stateStore = new CapacitorSecureStateStore(`${storageNamespace}.transactions`);
    const userStore = new CapacitorSecureStateStore(`${storageNamespace}.session`);
    const navigator = new CapacitorNavigator(configuration.nativeOptions?.prefersEphemeralWebBrowserSession ?? false);
    super(
      {
        ...configuration,
        settings: {
          ...configuration.settings,
          popup_redirect_uri: configuration.settings.redirect_uri,
          popup_post_logout_redirect_uri: configuration.settings.post_logout_redirect_uri,
          stateStore,
          userStore,
        },
      },
      navigator,
      navigator,
      new UnsupportedIframeNavigator(),
    );
    this.storageNamespace = storageNamespace;
  }

  static async fromConfiguration(configuration: ResolvedUserManagerConfiguration): Promise<NativeCapacitorUserManager> {
    await NativeOidc.configure(configuration.nativeOptions?.ios ?? {});
    return new NativeCapacitorUserManager(configuration);
  }

  protected override async initialize(): Promise<void> {
    await super.initialize();
    this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) this.checkForAutomaticRenewal();
    });
    this.checkForAutomaticRenewal();
  }

  override async signinRedirect(_args: SigninRedirectArgs = {}): Promise<void> {
    unsupported('Redirect navigation');
  }

  override async signinRedirectCallback(_url?: string): Promise<User> {
    unsupported('Redirect navigation');
  }

  override async signinCallback(_url?: string): Promise<User | undefined> {
    unsupported('Browser callback dispatch');
  }

  override async signinSilentCallback(_url?: string): Promise<void> {
    unsupported('Iframe navigation');
  }

  override async signoutRedirect(_args: SignoutRedirectArgs = {}): Promise<void> {
    unsupported('Redirect navigation');
  }

  override async signoutRedirectCallback(_url?: string): Promise<SignoutResponse> {
    unsupported('Redirect navigation');
  }

  override async signoutCallback(_url?: string, _keepOpen?: boolean): Promise<SignoutResponse | undefined> {
    unsupported('Browser callback dispatch');
  }

  override async signoutSilent(_args: SignoutSilentArgs = {}): Promise<void> {
    unsupported('Iframe logout');
  }

  override async signoutSilentCallback(_url?: string): Promise<void> {
    unsupported('Iframe logout');
  }

  override async querySessionStatus(_args: QuerySessionStatusArgs = {}): Promise<SessionStatus | null> {
    unsupported('Browser session monitoring');
  }

  override async storeUser(user: User | null): Promise<void> {
    await super.storeUser(user);
    await NativeOidc.setSessionSnapshot({
      namespace: this.storageNamespace,
      value: user
        ? JSON.stringify(
            toStoredSession(
              user,
              user.profile.iss ?? this.settings.metadata?.issuer ?? this.settings.authority,
              this.settings.client_id,
            ),
          )
        : null,
    });
  }

  override cancel(): Promise<void> {
    return NativeOidc.cancel();
  }

  protected override async disposePlatform(): Promise<void> {
    await this.appStateListener?.remove();
  }

  protected override async performSilentSignin(args: SigninSilentArgs): Promise<User | null> {
    const user = await this.getUser();
    if (!user?.refresh_token) {
      if (user?.expired) await this.removeUserWithoutWaiting();
      return null;
    }

    return super.performSilentSignin({ ...args, forceIframeAuth: false }).catch(async (error: unknown) => {
      if (error instanceof ErrorResponse && error.error === 'invalid_grant') await this.removeUserWithoutWaiting();
      throw error;
    });
  }
}

function toStoredSession(user: User, issuer: string, clientId: string): StoredSessionV1 {
  return {
    version: 1,
    issuer,
    clientId,
    accessToken: user.access_token,
    refreshToken: user.refresh_token,
    idToken: user.id_token,
    tokenType: user.token_type,
    scope: user.scope,
    expiresAt: user.expires_at,
  };
}
