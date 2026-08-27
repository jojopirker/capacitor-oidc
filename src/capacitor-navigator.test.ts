import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CapacitorNavigator,
  assertSecureRequestUrl,
  callbackUrlFromRequest,
  isExpectedCallback,
} from './capacitor-navigator';

const { open } = vi.hoisted(() => ({
  open: vi.fn(async ({ callbackUrl }: { callbackUrl: string }) => ({ url: `${callbackUrl}?code=code&state=state` })),
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    open,
    cancel: vi.fn(),
  }),
}));

beforeEach(() => {
  open.mockClear();
});

describe('CapacitorNavigator', () => {
  const url = 'https://issuer.example/authorize?redirect_uri=com.example.app%3A%2Fcallback';

  it('uses a shared browser session by default', async () => {
    const window = await new CapacitorNavigator(false).prepare();
    await window.navigate({ url });

    expect(open).toHaveBeenCalledWith({
      url,
      callbackUrl: 'com.example.app:/callback',
      prefersEphemeralWebBrowserSession: false,
    });
  });

  it('supports an ephemeral browser session when requested', async () => {
    const window = await new CapacitorNavigator(true).prepare();
    await window.navigate({ url });

    expect(open).toHaveBeenCalledWith({
      url,
      callbackUrl: 'com.example.app:/callback',
      prefersEphemeralWebBrowserSession: true,
    });
  });
});

describe('callbackUrlFromRequest', () => {
  it('reads an authorization redirect', () => {
    const request = 'https://issuer.example/authorize?redirect_uri=com.example.app%3A%2Fcallback';
    expect(callbackUrlFromRequest(request)).toBe('com.example.app:/callback');
  });

  it('reads a logout redirect', () => {
    const request = 'https://issuer.example/logout?post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogout';
    expect(callbackUrlFromRequest(request)).toBe('https://app.example/logout');
  });

  it('reads a Cognito logout redirect', () => {
    const request = 'https://issuer.example/logout?client_id=mobile&logout_uri=com.example.app%3A%2Flogout';
    expect(callbackUrlFromRequest(request)).toBe('com.example.app:/logout');
  });

  it('prefers the logout redirect when both callback parameters are present', () => {
    const request =
      'https://issuer.example/logout?redirect_uri=com.example.app%3A%2Fwrong&post_logout_redirect_uri=com.example.app%3A%2Flogout';
    expect(callbackUrlFromRequest(request)).toBe('com.example.app:/logout');
  });

  it('prefers the standard logout redirect over a provider-specific logout redirect', () => {
    const request =
      'https://issuer.example/logout?logout_uri=com.example.app%3A%2Fwrong&post_logout_redirect_uri=com.example.app%3A%2Flogout';
    expect(callbackUrlFromRequest(request)).toBe('com.example.app:/logout');
  });
});

describe('isExpectedCallback', () => {
  it('allows callback query parameters', () => {
    expect(isExpectedCallback('com.example.app:/callback?code=secret&state=state', 'com.example.app:/callback')).toBe(
      true,
    );
  });

  it('rejects a different callback path', () => {
    expect(isExpectedCallback('com.example.app:/other?code=secret', 'com.example.app:/callback')).toBe(false);
  });
});

describe('assertSecureRequestUrl', () => {
  it('requires HTTPS outside local development', () => {
    expect(() => assertSecureRequestUrl('http://identity.example/authorize')).toThrow(/must use HTTPS/);
    expect(() => assertSecureRequestUrl('http://localhost:8080/authorize')).not.toThrow();
    expect(() => assertSecureRequestUrl('custom://localhost/authorize')).toThrow(/must use HTTPS/);
  });
});
