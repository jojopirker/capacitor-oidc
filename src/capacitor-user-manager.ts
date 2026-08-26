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
import { NativeOidc } from './native';

export class CapacitorUserManager extends UserManager {
  private automaticRenewalPromise?: Promise<User | null>;
  private refreshPromise?: Promise<User | null>;
  private appStateListener?: PluginListenerHandle;

  private constructor(
    settings: CapacitorUserManagerSettings,
    nativeOptions: CapacitorOidcNativeOptions,
    private readonly storageNamespace: string,
  ) {
    const stateStore = new CapacitorSecureStateStore(`${storageNamespace}.transactions`);
    const userStore = new CapacitorSecureStateStore(`${storageNamespace}.session`);
    const navigator = new CapacitorNavigator(nativeOptions.prefersEphemeralWebBrowserSession ?? false);

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
    await NativeOidc.configure(nativeOptions.ios ?? {});
    const manager = new CapacitorUserManager(settings, nativeOptions, nativeOptions.storageNamespace ?? 'default');
    await manager.getUser();
    manager.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        manager.checkForAutomaticRenewal();
      }
    });
    manager.checkForAutomaticRenewal();
    return manager;
  }

  async signin(args: SigninPopupArgs = {}): Promise<User> {
    return this.signinPopup(args);
  }

  override async signinPopup(args: SigninPopupArgs = {}): Promise<User> {
    await this.waitForRenewal();
    return super.signinPopup(args);
  }

  async signout(args: SignoutPopupArgs = {}): Promise<void> {
    await this.signoutPopup(args);
  }

  override async signoutPopup(args: SignoutPopupArgs = {}): Promise<void> {
    await this.waitForRenewal();
    await super.signoutPopup(args);
  }

  private checkForAutomaticRenewal(): void {
    if (!this.settings.automaticSilentRenew || this.automaticRenewalPromise) return;
    const renewal = this.getValidUser();
    this.automaticRenewalPromise = renewal;
    void renewal
      .catch((error: unknown) =>
        this.events._raiseSilentRenewError(error instanceof Error ? error : new Error('Silent renewal failed')),
      )
      .finally(() => {
        if (this.automaticRenewalPromise === renewal) this.automaticRenewalPromise = undefined;
      });
  }

  async getValidUser(minimumValiditySeconds = 60): Promise<User | null> {
    const user = await this.getUser();
    if (!user) return null;
    if (user.expires_in === undefined || user.expires_in > minimumValiditySeconds) return user;
    return this.signinSilent();
  }

  override async removeUser(): Promise<void> {
    await this.waitForRenewal();
    await super.removeUser();
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
      if (user?.expired) await super.removeUser();
      return null;
    }

    const refresh = super.signinSilent({ ...args, forceIframeAuth: false }).catch(async (error: unknown) => {
      if (error instanceof ErrorResponse && error.error === 'invalid_grant') await super.removeUser();
      throw error;
    });
    return refresh;
  }

  private async waitForRenewal(): Promise<void> {
    await this.automaticRenewalPromise?.catch(() => undefined);
    await this.refreshPromise?.catch(() => undefined);
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

  async cancel(): Promise<void> {
    await NativeOidc.cancel();
  }

  async dispose(): Promise<void> {
    this.stopSilentRenew();
    await this.appStateListener?.remove();
    await this.waitForRenewal();
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
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', 'Web Crypto is required by oidc-client-ts');
  }
}

function assertSettings(settings: CapacitorUserManagerSettings): void {
  if ('client_secret' in settings) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', 'Native public clients must not contain a client secret');
  }
  if ('client_authentication' in settings || 'dpop' in settings) {
    throw new CapacitorOidcError(
      'UNSUPPORTED_RUNTIME',
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
