import { UserManager, type INavigator, type SigninResourceOwnerCredentialsArgs, type User } from 'oidc-client-ts';

import type { ResolvedUserManagerConfiguration } from './configuration.js';
import type { CapacitorSigninArgs, CapacitorSignoutArgs } from './definitions.js';
import { unsupported } from './errors.js';

export abstract class BaseCapacitorUserManager extends UserManager {
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

  override async signinResourceOwnerCredentials(_args: SigninResourceOwnerCredentialsArgs): Promise<User> {
    unsupported('Resource Owner Password Credentials');
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  async dispose(): Promise<void> {
    this.stopSilentRenew();
    await this.disposePlatform();
    await this.cancel();
  }

  protected abstract disposePlatform(): Promise<void>;
}
