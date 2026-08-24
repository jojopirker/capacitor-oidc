import type { UserManagerSettings } from 'oidc-client-ts';

export type CapacitorOidcErrorCode =
  | 'AUTH_SESSION_IN_PROGRESS'
  | 'USER_CANCELLED'
  | 'BROWSER_UNAVAILABLE'
  | 'INVALID_CALLBACK'
  | 'SECURE_STORAGE_ERROR'
  | 'UNSUPPORTED_RUNTIME';

export interface IOSNativeOptions {
  keychainAccessGroup?: string;
  keychainAccessibility?: 'afterFirstUnlockThisDeviceOnly' | 'whenUnlockedThisDeviceOnly';
}

export interface CapacitorOidcNativeOptions {
  ios?: IOSNativeOptions;
  prefersEphemeralWebBrowserSession?: boolean;
  storageNamespace?: string;
}

type UnsupportedSettings =
  | 'client_secret'
  | 'client_authentication'
  | 'disablePKCE'
  | 'dpop'
  | 'monitorSession'
  | 'response_type'
  | 'silent_redirect_uri'
  | 'stateStore'
  | 'userStore';

export type CapacitorUserManagerSettings = Omit<UserManagerSettings, UnsupportedSettings>;

export interface StoredSessionV1 {
  version: 1;
  issuer: string;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenType: string;
  scope?: string;
  expiresAt?: number;
}

export interface NativeOpenOptions {
  url: string;
  callbackUrl: string;
  prefersEphemeralWebBrowserSession: boolean;
}

export interface NativeStorageOptions {
  namespace: string;
  key: string;
}

export interface CapacitorOidcPlugin {
  configure(options: IOSNativeOptions): Promise<void>;
  open(options: NativeOpenOptions): Promise<{ url: string }>;
  cancel(): Promise<void>;
  storageSet(options: NativeStorageOptions & { value: string }): Promise<void>;
  storageGet(options: NativeStorageOptions): Promise<{ value: string | null }>;
  storageRemove(options: NativeStorageOptions): Promise<{ value: string | null }>;
  storageGetAllKeys(options: { namespace: string }): Promise<{ keys: string[] }>;
  setSessionSnapshot(options: { namespace: string; value: string | null }): Promise<void>;
}
