import {
  UserManager,
  type INavigator,
  type SigninPopupArgs,
  type SigninRedirectArgs,
  type SigninResourceOwnerCredentialsArgs,
  type SigninSilentArgs,
  type SignoutPopupArgs,
  type SignoutRedirectArgs,
  type User,
} from 'oidc-client-ts';

import type { ResolvedUserManagerConfiguration } from './configuration.js';
import type { CapacitorSigninArgs, CapacitorSignoutArgs } from './definitions.js';
import { unsupported } from './errors.js';

export abstract class BaseCapacitorUserManager extends UserManager {
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

  override async signinPopup(args: SigninPopupArgs = {}): Promise<User> {
    await this.waitForRenewal();
    return super.signinPopup(args);
  }

  override async signoutPopup(args: SignoutPopupArgs = {}): Promise<void> {
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
