import type { OidcMetadata, UserManagerSettings, MetadataService } from 'oidc-client-ts';

import { CapacitorOidcError } from './errors.js';

export function assertSecureRequestUrl(requestUrl: string): void {
  const url = new URL(requestUrl);
  const isHttpLoopback =
    url.protocol === 'http:' && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[/?#]|$)/i.test(requestUrl);
  if (url.protocol !== 'https:' && !isHttpLoopback) {
    throw new CapacitorOidcError('BROWSER_UNAVAILABLE', 'OIDC provider URLs must use HTTPS or HTTP on loopback');
  }
}

export function assertSecureMetadata(metadata: Partial<OidcMetadata> = {}): void {
  for (const key of [
    'issuer',
    'authorization_endpoint',
    'token_endpoint',
    'userinfo_endpoint',
    'check_session_iframe',
    'end_session_endpoint',
    'revocation_endpoint',
    'jwks_uri',
    'registration_endpoint',
  ] as const) {
    const url = metadata[key];
    if (url !== undefined) assertSecureRequestUrl(url);
  }
}

export function assertSecureSettings(settings: UserManagerSettings): void {
  assertSecureRequestUrl(settings.authority);
  if (settings.metadataUrl !== undefined) assertSecureRequestUrl(settings.metadataUrl);
  assertSecureMetadata(settings.metadata);
  assertSecureMetadata(settings.metadataSeed);
}

export function secureMetadataService(service: MetadataService): void {
  // All endpoint getters use getMetadata, including cached metadata and discovery merged with metadataSeed.
  const getMetadata = service.getMetadata.bind(service);
  service.getMetadata = async () => {
    const metadata = await getMetadata();
    assertSecureMetadata(metadata);
    return metadata;
  };
}
