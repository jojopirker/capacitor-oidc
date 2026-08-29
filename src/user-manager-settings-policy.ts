export const UNSAFE_PUBLIC_CLIENT_SETTINGS = [
  'client_secret',
  'client_authentication',
  'disablePKCE',
  'response_type',
] as const;

export const WEB_ONLY_SETTINGS = [
  'checkSessionIntervalInSeconds',
  'dpop',
  'iframeNotifyParentOrigin',
  'iframeScriptOrigin',
  'includeIdTokenInSilentSignout',
  'monitorAnonymousSession',
  'monitorSession',
  'popup_post_logout_redirect_uri',
  'popup_redirect_uri',
  'popupWindowFeatures',
  'popupWindowTarget',
  'query_status_response_type',
  'redirectMethod',
  'redirectTarget',
  'silent_redirect_uri',
  'silentRequestTimeoutInSeconds',
  'stateStore',
  'stopCheckSessionOnError',
  'userStore',
] as const;

export const LEGACY_NATIVE_UNSUPPORTED_SETTINGS = [
  'dpop',
  'monitorSession',
  'silent_redirect_uri',
  'stateStore',
  'userStore',
] as const;

export type UnsafePublicClientSetting = (typeof UNSAFE_PUBLIC_CLIENT_SETTINGS)[number];
export type WebOnlySetting = (typeof WEB_ONLY_SETTINGS)[number];
export type LegacyNativeUnsupportedSetting = (typeof LEGACY_NATIVE_UNSUPPORTED_SETTINGS)[number];
