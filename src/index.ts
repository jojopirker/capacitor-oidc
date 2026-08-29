import { CapacitorUserManager, setPlatformUserManagerFactory } from './capacitor-user-manager.js';
import { NativeCapacitorUserManager } from './native-capacitor-user-manager.js';
import { WebCapacitorUserManager } from './web-capacitor-user-manager.js';

setPlatformUserManagerFactory((configuration) =>
  configuration.platform === 'web'
    ? new WebCapacitorUserManager(configuration)
    : NativeCapacitorUserManager.fromConfiguration(configuration),
);

export { CapacitorUserManager };
export { CapacitorSecureStateStore } from './capacitor-secure-state-store.js';
export { CapacitorOidcError } from './errors.js';
export type {
  CapacitorOidcErrorCode,
  CapacitorOidcNativeOptions,
  CapacitorNativeUserManagerConfiguration,
  CapacitorNativeUserManagerOverride,
  CapacitorNativeUserManagerSettings,
  CapacitorSigninArgs,
  CapacitorSignoutArgs,
  CapacitorUserManagerCommonSettings,
  CapacitorUserManagerConfiguration,
  CapacitorUserManagerSettings,
  CapacitorWebUserManagerConfiguration,
  CapacitorWebUserManagerSettings,
  IOSNativeOptions,
  StoredSessionV1,
} from './definitions.js';
export { User, WebStorageStateStore } from 'oidc-client-ts';
export type { StateStore, UserManagerEvents } from 'oidc-client-ts';
