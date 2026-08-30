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

export type WebOnlySetting = (typeof WEB_ONLY_SETTINGS)[number];
