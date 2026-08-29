import type { UserManagerSettings } from 'oidc-client-ts';

import type {
  CapacitorOidcNativeOptions,
  CapacitorSigninArgs,
  CapacitorSignoutArgs,
  CapacitorUserManagerConfiguration,
  CapacitorUserManagerSettings,
} from './definitions.js';
import { CapacitorOidcError } from './errors.js';
import {
  LEGACY_NATIVE_UNSUPPORTED_SETTINGS,
  UNSAFE_PUBLIC_CLIENT_SETTINGS,
  WEB_ONLY_SETTINGS,
} from './user-manager-settings-policy.js';

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
  assertUnsupportedSettings(settings, LEGACY_NATIVE_UNSUPPORTED_SETTINGS, 'Native configuration');

  return resolvedNativeConfiguration(platform, settings, nativeOptions);
}

function resolveWebConfiguration(configuration: CapacitorUserManagerConfiguration): ResolvedUserManagerConfiguration {
  const web = configuration.web;
  if (!web) unsupportedConfiguration('web');

  const signoutMode = web.signoutMode ?? 'redirect';
  const settings: UserManagerSettings = { ...configuration.common, ...web.settings };
  assertPublicClient(settings);
  if (signoutMode === 'popup' && !settings.popup_post_logout_redirect_uri && !settings.post_logout_redirect_uri) {
    throw new CapacitorOidcError(
      'UNSUPPORTED_RUNTIME',
      'Web popup signout requires post_logout_redirect_uri or popup_post_logout_redirect_uri',
    );
  }

  return {
    platform: 'web',
    settings,
    signinMode: web.signinMode ?? 'redirect',
    signoutMode,
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
  assertUnsupportedSettings(settings, UNSAFE_PUBLIC_CLIENT_SETTINGS, 'Public-client configuration');
}

function assertNativeSettings(settings: object): void {
  assertUnsupportedSettings(settings, WEB_ONLY_SETTINGS, 'Native configuration');
}

function assertUnsupportedSettings(
  settings: object,
  unsupportedSettings: readonly string[],
  configurationName: string,
): void {
  const unsupported = unsupportedSettings.find((key) => key in settings);
  if (unsupported) {
    throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `${configurationName} does not support ${unsupported}`);
  }
}

function unsupportedConfiguration(platform: RuntimePlatform): never {
  throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `No ${platform} configuration was provided`);
}
