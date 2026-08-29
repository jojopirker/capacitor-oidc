import type { UserManagerSettings } from 'oidc-client-ts';

import type {
  CapacitorOidcNativeOptions,
  CapacitorSigninArgs,
  CapacitorSignoutArgs,
  CapacitorUserManagerConfiguration,
  CapacitorUserManagerSettings,
} from './definitions.js';
import { CapacitorOidcError } from './errors.js';

export type RuntimePlatform = 'android' | 'ios' | 'web';

export interface ResolvedUserManagerConfiguration {
  platform: RuntimePlatform;
  settings: UserManagerSettings;
  nativeOptions?: CapacitorOidcNativeOptions;
  signinMode: 'popup' | 'redirect';
  signoutMode: 'popup' | 'redirect';
  signinArgs: CapacitorSigninArgs;
  signoutArgs: CapacitorSignoutArgs;
}

export function resolveConfiguration(
  configuration: CapacitorUserManagerConfiguration,
  platform: RuntimePlatform,
): ResolvedUserManagerConfiguration {
  if (platform === 'web') return resolveWebConfiguration(configuration);
  return resolveNativeConfiguration(configuration, platform);
}

export function resolveLegacyNativeConfiguration(
  settings: CapacitorUserManagerSettings,
  nativeOptions: CapacitorOidcNativeOptions,
  platform: RuntimePlatform,
): ResolvedUserManagerConfiguration {
  if (platform === 'web') {
    throw new CapacitorOidcError(
      'UNSUPPORTED_RUNTIME',
      'Legacy CapacitorUserManager settings are only supported on iOS and Android',
    );
  }

  assertPublicClient(settings);
  if ('dpop' in settings) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', 'Native configuration does not support dpop');
  }

  return resolvedNativeConfiguration(platform, settings, nativeOptions);
}

function resolveWebConfiguration(configuration: CapacitorUserManagerConfiguration): ResolvedUserManagerConfiguration {
  const web = configuration.web;
  if (!web) unsupportedConfiguration('web');

  const settings: UserManagerSettings = { ...configuration.common, ...web.settings };
  assertPublicClient(settings);

  return {
    platform: 'web',
    settings,
    signinMode: web.signinMode ?? 'redirect',
    signoutMode: web.signoutMode ?? 'redirect',
    signinArgs: web.signinArgs ?? {},
    signoutArgs: web.signoutArgs ?? {},
  };
}

function resolveNativeConfiguration(
  configuration: CapacitorUserManagerConfiguration,
  platform: 'android' | 'ios',
): ResolvedUserManagerConfiguration {
  const native = configuration.native;
  if (!native) unsupportedConfiguration(platform);

  const override = configuration[platform];
  const settings = { ...configuration.common, ...native.settings, ...override?.settings };
  assertPublicClient(settings);
  assertNativeSettings(settings);

  return resolvedNativeConfiguration(
    platform,
    settings,
    { ...native.options, ...override?.options },
    { ...native.signinArgs, ...override?.signinArgs },
    { ...native.signoutArgs, ...override?.signoutArgs },
  );
}

function resolvedNativeConfiguration(
  platform: 'android' | 'ios',
  settings: UserManagerSettings,
  nativeOptions: CapacitorOidcNativeOptions,
  signinArgs: CapacitorSigninArgs = {},
  signoutArgs: CapacitorSignoutArgs = {},
): ResolvedUserManagerConfiguration {
  return {
    platform,
    settings: { ...settings, response_type: 'code', disablePKCE: false, monitorSession: false },
    nativeOptions,
    signinMode: 'popup',
    signoutMode: 'popup',
    signinArgs,
    signoutArgs,
  };
}

function assertPublicClient(settings: object): void {
  const unsupported = ['client_authentication', 'client_secret', 'disablePKCE', 'response_type'].find(
    (key) => key in settings,
  );
  if (unsupported) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `Public-client configuration does not support ${unsupported}`);
  }
}

function assertNativeSettings(settings: object): void {
  const unsupported = ['dpop', 'monitorSession', 'silent_redirect_uri', 'stateStore', 'userStore'].find(
    (key) => key in settings,
  );
  if (unsupported) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `Native configuration does not support ${unsupported}`);
  }
}

function unsupportedConfiguration(platform: RuntimePlatform): never {
  throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `No ${platform} configuration was provided`);
}
