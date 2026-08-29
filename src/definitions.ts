import type {
  SigninPopupArgs,
  SigninRedirectArgs,
  SignoutPopupArgs,
  SignoutRedirectArgs,
  UserManagerSettings,
} from 'oidc-client-ts';

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

type UnsafePublicClientSettings = 'client_secret' | 'client_authentication' | 'disablePKCE' | 'response_type';

type LegacyUnsupportedSettings =
  | UnsafePublicClientSettings
  | 'dpop'
  | 'monitorSession'
  | 'silent_redirect_uri'
  | 'stateStore'
  | 'userStore';

type WebOnlySettings =
  | 'checkSessionIntervalInSeconds'
  | 'dpop'
  | 'iframeNotifyParentOrigin'
  | 'iframeScriptOrigin'
  | 'includeIdTokenInSilentSignout'
  | 'monitorAnonymousSession'
  | 'monitorSession'
  | 'popup_post_logout_redirect_uri'
  | 'popup_redirect_uri'
  | 'popupWindowFeatures'
  | 'popupWindowTarget'
  | 'query_status_response_type'
  | 'redirectMethod'
  | 'redirectTarget'
  | 'silent_redirect_uri'
  | 'silentRequestTimeoutInSeconds'
  | 'stateStore'
  | 'stopCheckSessionOnError'
  | 'userStore';

type PublicClientUserManagerSettings = Omit<UserManagerSettings, UnsafePublicClientSettings>;
type NativeUserManagerSettings = Omit<PublicClientUserManagerSettings, WebOnlySettings>;

/** @deprecated Use CapacitorUserManagerConfiguration. */
export type CapacitorUserManagerSettings = Omit<UserManagerSettings, LegacyUnsupportedSettings>;

export type CapacitorUserManagerCommonSettings = Omit<
  PublicClientUserManagerSettings,
  WebOnlySettings | 'post_logout_redirect_uri' | 'redirect_uri'
>;

export type CapacitorWebUserManagerSettings = Partial<Omit<PublicClientUserManagerSettings, 'redirect_uri'>> & {
  redirect_uri: string;
};

export type CapacitorNativeUserManagerSettings = Partial<Omit<NativeUserManagerSettings, 'redirect_uri'>> & {
  redirect_uri: string;
};

export type CapacitorSigninArgs = SigninPopupArgs & SigninRedirectArgs;
export type CapacitorSignoutArgs = SignoutPopupArgs & SignoutRedirectArgs;

export interface CapacitorWebUserManagerConfiguration {
  settings: CapacitorWebUserManagerSettings;
  signinMode?: 'popup' | 'redirect';
  signoutMode?: 'popup' | 'redirect';
  signinArgs?: CapacitorSigninArgs;
  signoutArgs?: CapacitorSignoutArgs;
}

export interface CapacitorNativeUserManagerConfiguration {
  settings: CapacitorNativeUserManagerSettings;
  options?: CapacitorOidcNativeOptions;
  signinArgs?: CapacitorSigninArgs;
  signoutArgs?: CapacitorSignoutArgs;
}

export interface CapacitorNativeUserManagerOverride {
  settings?: Partial<CapacitorNativeUserManagerSettings>;
  options?: CapacitorOidcNativeOptions;
  signinArgs?: CapacitorSigninArgs;
  signoutArgs?: CapacitorSignoutArgs;
}

export interface CapacitorUserManagerConfiguration {
  common: CapacitorUserManagerCommonSettings;
  web?: CapacitorWebUserManagerConfiguration;
  native?: CapacitorNativeUserManagerConfiguration;
  ios?: CapacitorNativeUserManagerOverride;
  android?: CapacitorNativeUserManagerOverride;
}

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
