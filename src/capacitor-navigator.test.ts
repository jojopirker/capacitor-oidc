import { describe, expect, it } from 'vitest';

import { assertSecureRequestUrl, callbackUrlFromRequest, isExpectedCallback } from './capacitor-navigator';

describe('callbackUrlFromRequest', () => {
  it('reads an authorization redirect', () => {
    const request = 'https://issuer.example/authorize?redirect_uri=com.example.app%3A%2Fcallback';
    expect(callbackUrlFromRequest(request)).toBe('com.example.app:/callback');
  });

  it('reads a logout redirect', () => {
    const request = 'https://issuer.example/logout?post_logout_redirect_uri=https%3A%2F%2Fapp.example%2Flogout';
    expect(callbackUrlFromRequest(request)).toBe('https://app.example/logout');
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
  });
});
