import { Capacitor } from '@capacitor/core';
import {
  UserManager,
  type INavigator,
  type SigninRedirectArgs,
  type SigninResourceOwnerCredentialsArgs,
  type SigninSilentArgs,
  type SignoutRedirectArgs,
  type User,
} from 'oidc-client-ts';

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
} from './definitions.js';
import { CapacitorOidcError, unsupported } from './errors.js';

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

    const manager = await platformUserManagerFactory(resolved);
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

type PlatformUserManagerFactory = (
  configuration: ResolvedUserManagerConfiguration,
) => CapacitorUserManager | Promise<CapacitorUserManager>;

let platformUserManagerFactory: PlatformUserManagerFactory;

export function setPlatformUserManagerFactory(factory: PlatformUserManagerFactory): void {
  platformUserManagerFactory = factory;
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
