import { Capacitor } from '@capacitor/core';

import { BaseCapacitorUserManager } from './base-capacitor-user-manager.js';
import {
  resolveConfiguration,
  resolveLegacyNativeConfiguration,
  type ResolvedUserManagerConfiguration,
  type RuntimePlatform,
} from './configuration.js';
import type {
  CapacitorOidcNativeOptions,
  CapacitorUserManagerConfiguration,
  CapacitorUserManagerSettings,
} from './definitions.js';
import { CapacitorOidcError } from './errors.js';

export abstract class CapacitorUserManager extends BaseCapacitorUserManager {
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
