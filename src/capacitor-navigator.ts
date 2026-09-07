import type { INavigator, IWindow, NavigateParams, NavigateResponse } from 'oidc-client-ts';

import { CapacitorOidcError, unsupported } from './errors.js';
import { NativeOidc } from './native.js';
import { assertSecureRequestUrl } from './transport-policy.js';

export class CapacitorNavigator implements INavigator {
  constructor(private readonly prefersEphemeralWebBrowserSession: boolean) {}

  async prepare(): Promise<IWindow> {
    return new CapacitorWindow(this.prefersEphemeralWebBrowserSession);
  }

  async callback(): Promise<void> {
    unsupported('Navigator callbacks');
  }
}

class CapacitorWindow implements IWindow {
  constructor(private readonly prefersEphemeralWebBrowserSession: boolean) {}

  async navigate({ url }: NavigateParams): Promise<NavigateResponse> {
    assertSecureRequestUrl(url);
    const callbackUrl = callbackUrlFromRequest(url);
    const response = await NativeOidc.open({
      url,
      callbackUrl,
      prefersEphemeralWebBrowserSession: this.prefersEphemeralWebBrowserSession,
    });

    if (!isExpectedCallback(response.url, callbackUrl)) {
      throw new CapacitorOidcError(
        'INVALID_CALLBACK',
        'The authentication callback does not match the configured redirect URI',
      );
    }

    return response;
  }

  close(): void {
    void NativeOidc.cancel();
  }
}

export function callbackUrlFromRequest(requestUrl: string): string {
  const url = new URL(requestUrl);
  const callback =
    url.searchParams.get('post_logout_redirect_uri') ??
    url.searchParams.get('logout_uri') ??
    url.searchParams.get('redirect_uri');
  if (!callback) {
    throw new CapacitorOidcError('INVALID_CALLBACK', 'The OIDC request does not contain a callback URI');
  }
  return callback;
}

export function isExpectedCallback(actualValue: string, expectedValue: string): boolean {
  const actual = new URL(actualValue);
  const expected = new URL(expectedValue);
  return (
    actual.protocol.toLowerCase() === expected.protocol.toLowerCase() &&
    actual.host.toLowerCase() === expected.host.toLowerCase() &&
    actual.pathname === expected.pathname
  );
}

export class UnsupportedIframeNavigator implements INavigator {
  async prepare(): Promise<IWindow> {
    unsupported('Iframe navigation');
  }

  async callback(): Promise<void> {
    unsupported('Iframe navigation');
  }
}
