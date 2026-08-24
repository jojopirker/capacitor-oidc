import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  ErrorResponse,
  UserManager,
  type SigninPopupArgs,
  type SigninResourceOwnerCredentialsArgs,
  type SigninSilentArgs,
  type SignoutResponse,
  type SignoutPopupArgs,
  type User,
} from 'oidc-client-ts';

import { CapacitorNavigator, UnsupportedIframeNavigator } from './capacitor-navigator';
import { CapacitorSecureStateStore } from './capacitor-secure-state-store';
import type { CapacitorOidcNativeOptions, CapacitorUserManagerSettings, StoredSessionV1 } from './definitions';
import { CapacitorOidcError, unsupported } from './errors';
import { nativeContract } from './generated/native-contract';
import { NativeOidc } from './native';

export class CapacitorUserManager extends UserManager {
  private refreshPromise?: Promise<User | null>;
  private appStateListener?: PluginListenerHandle;

  private constructor(
    settings: CapacitorUserManagerSettings,
    nativeOptions: CapacitorOidcNativeOptions,
    private readonly storageNamespace: string,
  ) {
    const stateStore = new CapacitorSecureStateStore(`${storageNamespace}.transactions`);
    const userStore = new CapacitorSecureStateStore(`${storageNamespace}.session`);
    const navigator = new CapacitorNavigator(nativeOptions.ios?.prefersEphemeralWebBrowserSession ?? false);

    super(
      {
        ...settings,
        response_type: 'code',
        disablePKCE: false,
        monitorSession: false,
        popup_redirect_uri: settings.redirect_uri,
        popup_post_logout_redirect_uri: settings.post_logout_redirect_uri,
        stateStore,
        userStore,
      },
      navigator,
      navigator,
      new UnsupportedIframeNavigator(),
    );
  }

  static async create(
    settings: CapacitorUserManagerSettings,
    nativeOptions: CapacitorOidcNativeOptions = {},
  ): Promise<CapacitorUserManager> {
    assertRuntime();
    assertSettings(settings);
    await NativeOidc.configure({
      [nativeContract.fields.prefersEphemeralWebBrowserSession]: nativeOptions.ios?.prefersEphemeralWebBrowserSession,
      [nativeContract.fields.keychainAccessGroup]: nativeOptions.ios?.keychainAccessGroup,
      [nativeContract.fields.keychainAccessibility]: nativeOptions.ios?.keychainAccessibility,
    });
    const manager = new CapacitorUserManager(settings, nativeOptions, nativeOptions.storageNamespace ?? 'default');
    await manager.getValidUser();
    manager.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void manager
          .getValidUser()
          .catch((error: unknown) =>
            manager.events._raiseSilentRenewError(error instanceof Error ? error : new Error('Silent renewal failed')),
          );
      }
    });
    return manager;
  }

  async signin(args: SigninPopupArgs = {}): Promise<User> {
    return super.signinPopup(args);
  }

  async signout(args: SignoutPopupArgs = {}): Promise<void> {
    await super.signoutPopup(args);
  }

  async getValidUser(minimumValiditySeconds = 60): Promise<User | null> {
    const user = await this.getUser();
    if (!user) return null;
    if (user.expires_in === undefined || user.expires_in > minimumValiditySeconds) return user;
    return this.signinSilent();
  }

  override signinSilent(args: SigninSilentArgs = {}): Promise<User | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.refresh(args).finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  private async refresh(args: SigninSilentArgs): Promise<User | null> {
    const user = await this.getUser();
    if (!user?.refresh_token) {
      if (user?.expired) await this.removeUser();
      return null;
    }

    const refresh = super.signinSilent({ ...args, forceIframeAuth: false }).catch(async (error: unknown) => {
      if (error instanceof ErrorResponse && error.error === 'invalid_grant') await this.removeUser();
      throw error;
    });
    return refresh;
  }

  override async storeUser(user: User | null): Promise<void> {
    await super.storeUser(user);
    await NativeOidc.setSessionSnapshot({
      [nativeContract.fields.namespace]: this.storageNamespace,
      [nativeContract.fields.value]: user
        ? JSON.stringify(toStoredSession(user, this.settings.authority, this.settings.client_id))
        : null,
    });
  }

  async cancel(): Promise<void> {
    await NativeOidc.cancel();
  }

  async dispose(): Promise<void> {
    this.stopSilentRenew();
    await this.appStateListener?.remove();
    await this.cancel();
  }

  override async signinRedirect(): Promise<void> {
    unsupported('Redirect navigation');
  }

  override async signinRedirectCallback(_url?: string): Promise<User> {
    unsupported('Redirect navigation');
  }

  override async signinCallback(_url?: string): Promise<User | undefined> {
    unsupported('Browser callback dispatch');
  }

  override async signinResourceOwnerCredentials(_args: SigninResourceOwnerCredentialsArgs): Promise<User> {
    unsupported('Resource Owner Password Credentials');
  }

  override async signinSilentCallback(_url?: string): Promise<void> {
    unsupported('Iframe navigation');
  }

  override async signoutRedirect(): Promise<void> {
    unsupported('Redirect navigation');
  }

  override async signoutRedirectCallback(_url?: string): Promise<SignoutResponse> {
    unsupported('Redirect navigation');
  }

  override async signoutCallback(_url?: string, _keepOpen?: boolean): Promise<SignoutResponse | undefined> {
    unsupported('Browser callback dispatch');
  }

  override async signoutSilent(): Promise<void> {
    unsupported('Iframe logout');
  }

  override async signoutSilentCallback(_url?: string): Promise<void> {
    unsupported('Iframe logout');
  }

  override async querySessionStatus(): Promise<null> {
    unsupported('Browser session monitoring');
  }
}

function assertRuntime(): void {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new CapacitorOidcError(
      nativeContract.errorCodes.unsupportedRuntime,
      'Web Crypto is required by oidc-client-ts',
    );
  }
}

function assertSettings(settings: CapacitorUserManagerSettings): void {
  if ('client_secret' in settings) {
    throw new CapacitorOidcError(
      nativeContract.errorCodes.unsupportedRuntime,
      'Native public clients must not contain a client secret',
    );
  }
  if ('client_authentication' in settings || 'dpop' in settings) {
    throw new CapacitorOidcError(
      nativeContract.errorCodes.unsupportedRuntime,
      'The supplied settings contain an unsupported native-client option',
    );
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
