import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  ErrorResponse,
  UserManager,
  type QuerySessionStatusArgs,
  type SessionStatus,
  type SigninRedirectArgs,
  type SigninResourceOwnerCredentialsArgs,
  type SigninSilentArgs,
  type SignoutResponse,
  type SignoutRedirectArgs,
  type SignoutSilentArgs,
  type User,
} from 'oidc-client-ts';

import { CapacitorNavigator, UnsupportedIframeNavigator } from './capacitor-navigator.js';
import { CapacitorSecureStateStore } from './capacitor-secure-state-store.js';
import { resolveConfiguration, type ResolvedUserManagerConfiguration, type RuntimePlatform } from './configuration.js';
import type {
  CapacitorSigninArgs,
  CapacitorSignoutArgs,
  CapacitorUserManagerConfiguration,
  StoredSessionV1,
} from './definitions.js';
import { CapacitorOidcError, unsupported } from './errors.js';
import { NativeOidc } from './native.js';

interface SessionMonitorLifecycle {
  start(user: User): Promise<void>;
  stop(): void;
}

interface InternalSessionMonitor {
  _start(user: User): Promise<void>;
  _stop(): void;
}

export class CapacitorUserManager extends UserManager {
  private automaticRenewalPromise?: Promise<User | null>;
  private refreshPromise?: Promise<User | null>;
  private appStateListener?: PluginListenerHandle;
  private readonly isNative: boolean;
  private readonly storageNamespace: string;
  private readonly signinMode: 'popup' | 'redirect';
  private readonly signoutMode: 'popup' | 'redirect';
  private readonly defaultSigninArgs: CapacitorSigninArgs;
  private readonly defaultSignoutArgs: CapacitorSignoutArgs;
  private readonly sessionMonitor?: SessionMonitorLifecycle;
  private disposed = false;

  private constructor(configuration: ResolvedUserManagerConfiguration) {
    const isNative = configuration.platform !== 'web';
    const storageNamespace = configuration.nativeOptions?.storageNamespace ?? 'default';
    const stateStore = isNative ? new CapacitorSecureStateStore(`${storageNamespace}.transactions`) : undefined;
    const userStore = isNative ? new CapacitorSecureStateStore(`${storageNamespace}.session`) : undefined;
    const navigator = isNative
      ? new CapacitorNavigator(configuration.nativeOptions?.prefersEphemeralWebBrowserSession ?? false)
      : undefined;

    super(
      isNative
        ? {
            ...configuration.settings,
            popup_redirect_uri: configuration.settings.redirect_uri,
            popup_post_logout_redirect_uri: configuration.settings.post_logout_redirect_uri,
            stateStore,
            userStore,
          }
        : configuration.settings,
      navigator,
      navigator,
      isNative ? new UnsupportedIframeNavigator() : undefined,
    );

    this.isNative = isNative;
    this.storageNamespace = storageNamespace;
    this.signinMode = configuration.signinMode;
    this.signoutMode = configuration.signoutMode;
    this.defaultSigninArgs = configuration.signinArgs;
    this.defaultSignoutArgs = configuration.signoutArgs;
    this.sessionMonitor = this.captureSessionMonitor();
  }

  static async create(configuration: CapacitorUserManagerConfiguration): Promise<CapacitorUserManager> {
    assertRuntime();
    const resolved = resolveConfiguration(configuration, currentPlatform());
    if (resolved.platform !== 'web') await NativeOidc.configure(resolved.nativeOptions?.ios ?? {});

    const manager = new CapacitorUserManager(resolved);
    await manager.getUser();

    if (manager.isNative) {
      manager.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) manager.checkForAutomaticRenewal();
      });
      manager.checkForAutomaticRenewal();
    }

    return manager;
  }

  async signin(args: CapacitorSigninArgs = {}): Promise<void> {
    const mergedArgs = { ...this.defaultSigninArgs, ...args };
    if (this.signinMode === 'redirect') return this.signinRedirect(mergedArgs);
    await this.signinPopup(mergedArgs);
  }

  async signout(args: CapacitorSignoutArgs = {}): Promise<void> {
    const mergedArgs = { ...this.defaultSignoutArgs, ...args };
    if (this.signoutMode === 'redirect') return this.signoutRedirect(mergedArgs);
    await this.signoutPopup(mergedArgs);
  }

  async getValidUser(minimumValiditySeconds = 60): Promise<User | null> {
    const user = await this.getUser();
    if (!user) return null;
    if (user.expires_in === undefined || user.expires_in > minimumValiditySeconds) return user;
    return this.signinSilent();
  }

  override async signinPopup(args: CapacitorSigninArgs = {}): Promise<User> {
    await this.waitForRenewal();
    return super.signinPopup(args);
  }

  override async signoutPopup(args: CapacitorSignoutArgs = {}): Promise<void> {
    await this.waitForRenewal();
    await super.signoutPopup(args);
  }

  override async signinRedirect(args: SigninRedirectArgs = {}): Promise<void> {
    if (this.isNative) unsupported('Redirect navigation');
    await this.waitForRenewal();
    await super.signinRedirect(args);
  }

  override async signinRedirectCallback(url?: string): Promise<User> {
    if (this.isNative) unsupported('Redirect navigation');
    return super.signinRedirectCallback(url);
  }

  override async signinCallback(url?: string): Promise<User | undefined> {
    if (this.isNative) unsupported('Browser callback dispatch');
    return super.signinCallback(url);
  }

  override async signoutRedirect(args: SignoutRedirectArgs = {}): Promise<void> {
    if (this.isNative) unsupported('Redirect navigation');
    await this.waitForRenewal();
    await super.signoutRedirect(args);
  }

  override async signoutRedirectCallback(url?: string): Promise<SignoutResponse> {
    if (this.isNative) unsupported('Redirect navigation');
    return super.signoutRedirectCallback(url);
  }

  override async signoutCallback(url?: string, keepOpen?: boolean): Promise<SignoutResponse | undefined> {
    if (this.isNative) unsupported('Browser callback dispatch');
    return super.signoutCallback(url, keepOpen);
  }

  override signinSilent(args: SigninSilentArgs = {}): Promise<User | null> {
    if (!this.refreshPromise) {
      const refresh = this.isNative ? this.refreshNative(args) : super.signinSilent(args);
      this.refreshPromise = refresh.finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  override async signinSilentCallback(url?: string): Promise<void> {
    if (this.isNative) unsupported('Iframe navigation');
    await super.signinSilentCallback(url);
  }

  override async signoutSilent(args: SignoutSilentArgs = {}): Promise<void> {
    if (this.isNative) unsupported('Iframe logout');
    await super.signoutSilent(args);
  }

  override async signoutSilentCallback(url?: string): Promise<void> {
    if (this.isNative) unsupported('Iframe logout');
    await super.signoutSilentCallback(url);
  }

  override async querySessionStatus(args: QuerySessionStatusArgs = {}): Promise<SessionStatus | null> {
    if (this.isNative) unsupported('Browser session monitoring');
    if (this.disposed) return null;
    const session = await super.querySessionStatus(args);
    return this.disposed ? null : session;
  }

  override async signinResourceOwnerCredentials(_args: SigninResourceOwnerCredentialsArgs): Promise<User> {
    unsupported('Resource Owner Password Credentials');
  }

  override async removeUser(): Promise<void> {
    await this.waitForRenewal();
    await super.removeUser();
  }

  override async storeUser(user: User | null): Promise<void> {
    await super.storeUser(user);
    if (!this.isNative) return;

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
    if (this.isNative) await NativeOidc.cancel();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.stopSilentRenew();
    if (this.sessionMonitor) {
      this.events.removeUserLoaded(this.sessionMonitor.start);
      this.events.removeUserUnloaded(this.sessionMonitor.stop);
      this.sessionMonitor.stop();
    }
    await this.appStateListener?.remove();
    await this.waitForRenewal();
    await this.cancel();
  }

  private captureSessionMonitor(): SessionMonitorLifecycle | undefined {
    // oidc-client-ts does not expose public session-monitor lifecycle hooks.
    const monitor = this._sessionMonitor as unknown as InternalSessionMonitor | null;
    if (!monitor) return undefined;

    const originalStart = monitor._start;
    const stop = monitor._stop;
    const start = async (user: User) => {
      if (this.disposed) return;
      await originalStart(user);
      if (this.disposed) stop();
    };
    this.events.removeUserLoaded(originalStart);
    this.events.addUserLoaded(start);
    monitor._start = start;
    return { start, stop };
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

  private async refreshNative(args: SigninSilentArgs): Promise<User | null> {
    const user = await this.getUser();
    if (!user?.refresh_token) {
      if (user?.expired) await super.removeUser();
      return null;
    }

    return super.signinSilent({ ...args, forceIframeAuth: false }).catch(async (error: unknown) => {
      if (error instanceof ErrorResponse && error.error === 'invalid_grant') await super.removeUser();
      throw error;
    });
  }

  private async waitForRenewal(): Promise<void> {
    await this.automaticRenewalPromise?.catch(() => undefined);
    await this.refreshPromise?.catch(() => undefined);
  }
}

function currentPlatform(): RuntimePlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

function assertRuntime(): void {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', 'Web Crypto is required by oidc-client-ts');
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
