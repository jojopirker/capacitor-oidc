import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  ErrorResponse,
  UserManager,
  type INavigator,
  type QuerySessionStatusArgs,
  type SessionStatus,
  type SigninRedirectArgs,
  type SigninResourceOwnerCredentialsArgs,
  type SigninSilentArgs,
  type SignoutRedirectArgs,
  type SignoutResponse,
  type SignoutSilentArgs,
  type User,
} from 'oidc-client-ts';

import { CapacitorNavigator, UnsupportedIframeNavigator } from './capacitor-navigator.js';
import { CapacitorSecureStateStore } from './capacitor-secure-state-store.js';
import {
  resolveConfiguration,
  resolveLegacyNativeConfiguration,
  type ResolvedUserManagerConfiguration,
  type RuntimePlatform,
} from './configuration.js';
import type {
  CapacitorOidcNativeOptions,
  CapacitorSigninArgs,
  CapacitorSignoutArgs,
  CapacitorUserManagerConfiguration,
  CapacitorUserManagerSettings,
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

export abstract class CapacitorUserManager extends UserManager {
  private automaticRenewalPromise?: Promise<User | null>;
  private refreshPromise?: Promise<User | null>;
  private readonly signinMode: 'popup' | 'redirect';
  private readonly signoutMode: 'popup' | 'redirect';
  private readonly defaultSigninArgs: CapacitorSigninArgs;
  private readonly defaultSignoutArgs: CapacitorSignoutArgs;

  protected constructor(
    configuration: ResolvedUserManagerConfiguration,
    redirectNavigator?: INavigator,
    popupNavigator?: INavigator,
    iframeNavigator?: INavigator,
  ) {
    super(configuration.settings, redirectNavigator, popupNavigator, iframeNavigator);
    this.signinMode = configuration.signinMode;
    this.signoutMode = configuration.signoutMode;
    this.defaultSigninArgs = configuration.signinArgs;
    this.defaultSignoutArgs = configuration.signoutArgs;
  }

  static create(configuration: CapacitorUserManagerConfiguration): Promise<CapacitorUserManager>;
  /** @deprecated Use the platform configuration object. */
  static create(
    settings: CapacitorUserManagerSettings,
    nativeOptions?: CapacitorOidcNativeOptions,
  ): Promise<CapacitorUserManager>;
  static async create(
    configuration: CapacitorUserManagerConfiguration | CapacitorUserManagerSettings,
    nativeOptions: CapacitorOidcNativeOptions = {},
  ): Promise<CapacitorUserManager> {
    assertRuntime();
    const platform = currentPlatform();
    const resolved =
      'redirect_uri' in configuration
        ? resolveLegacyNativeConfiguration(configuration, nativeOptions, platform)
        : resolveConfiguration(configuration, platform);

    const manager: CapacitorUserManager =
      resolved.platform === 'web'
        ? new WebCapacitorUserManager(resolved)
        : await NativeCapacitorUserManager.fromConfiguration(resolved);
    await manager.initialize();
    return manager;
  }

  protected async initialize(): Promise<void> {
    await this.getUser();
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
    await this.waitForRenewal();
    await super.signinRedirect(args);
  }

  override async signoutRedirect(args: SignoutRedirectArgs = {}): Promise<void> {
    await this.waitForRenewal();
    await super.signoutRedirect(args);
  }

  override signinSilent(args: SigninSilentArgs = {}): Promise<User | null> {
    if (!this.refreshPromise) {
      const refresh = this.performSilentSignin(args);
      this.refreshPromise = refresh.finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  override async signinResourceOwnerCredentials(_args: SigninResourceOwnerCredentialsArgs): Promise<User> {
    unsupported('Resource Owner Password Credentials');
  }

  override async removeUser(): Promise<void> {
    await this.waitForRenewal();
    await this.removeUserWithoutWaiting();
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  async dispose(): Promise<void> {
    this.stopSilentRenew();
    await this.disposePlatform();
    await this.waitForRenewal();
    await this.cancel();
  }

  protected performSilentSignin(args: SigninSilentArgs): Promise<User | null> {
    return super.signinSilent(args);
  }

  protected removeUserWithoutWaiting(): Promise<void> {
    return super.removeUser();
  }

  protected checkForAutomaticRenewal(): void {
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

  protected abstract disposePlatform(): Promise<void>;

  private async waitForRenewal(): Promise<void> {
    await this.automaticRenewalPromise?.catch(() => undefined);
    await this.refreshPromise?.catch(() => undefined);
  }
}

class WebCapacitorUserManager extends CapacitorUserManager {
  private readonly sessionMonitor?: SessionMonitorLifecycle;
  private disposed = false;

  constructor(configuration: ResolvedUserManagerConfiguration) {
    super(configuration);
    this.sessionMonitor = this.captureSessionMonitor();
  }

  override async querySessionStatus(args: QuerySessionStatusArgs = {}): Promise<SessionStatus | null> {
    if (this.disposed) return null;
    const session = await super.querySessionStatus(args);
    return this.disposed ? null : session;
  }

  protected disposePlatform(): Promise<void> {
    this.disposed = true;
    if (this.sessionMonitor) {
      this.events.removeUserLoaded(this.sessionMonitor.start);
      this.events.removeUserUnloaded(this.sessionMonitor.stop);
      this.sessionMonitor.stop();
    }
    return Promise.resolve();
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
}

class NativeCapacitorUserManager extends CapacitorUserManager {
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
