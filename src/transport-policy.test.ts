import { InMemoryWebStorage, User, WebStorageStateStore } from 'oidc-client-ts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertSecureRequestUrl } from './transport-policy';
import { WebCapacitorUserManager } from './web-capacitor-user-manager';

function manager(overrides = {}) {
  return new NavigationTestManager({
    platform: 'web',
    settings: {
      authority: 'https://issuer.example',
      client_id: 'client',
      redirect_uri: 'https://app.example/callback',
      automaticSilentRenew: false,
      stateStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      ...overrides,
    },
    signinMode: 'redirect',
    signoutMode: 'redirect',
    signinArgs: {},
    signoutArgs: {},
  });
}

afterEach(() => vi.unstubAllGlobals());

const accepted = ['https://issuer.example', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://[::1]:8080'];
const endpoints = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'revocation_endpoint',
  'end_session_endpoint',
  'check_session_iframe',
  'jwks_uri',
  'registration_endpoint',
];

describe('provider transport policy', () => {
  it.each(accepted)('accepts %s', async (url) => {
    expect(() => assertSecureRequestUrl(url)).not.toThrow();
    const client = manager({
      authority: url,
      metadataUrl: url,
      metadata: { token_endpoint: url },
      metadataSeed: { token_endpoint: url },
    });
    expect(await client.metadataService.getTokenEndpoint()).toBe(url);
  });

  it.each([
    'http://issuer.example',
    'http://localhost.example',
    'http://127.0.0.2',
    'http://127.1',
    'http://2130706433',
    'ftp://localhost',
  ])('rejects %s', (url) => {
    expect(() => assertSecureRequestUrl(url)).toThrow();
  });

  it.each(['authority', 'metadataUrl'])('rejects insecure %s before fetching', (key) => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(() => manager({ [key]: 'http://issuer.example' })).toThrow(/HTTPS/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(endpoints)('rejects configured and seeded %s', (key) => {
    for (const source of ['metadata', 'metadataSeed']) {
      expect(() => manager({ [source]: { [key]: 'http://issuer.example' } })).toThrow(/HTTPS/);
    }
  });

  it.each(endpoints)('rejects discovered %s before refreshing credentials', async (key) => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token_endpoint: 'https://issuer.example/token',
          [key]: 'http://issuer.example/insecure',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const client = manager();
    await client.storeUser(
      new User({
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        token_type: 'Bearer',
        profile: { sub: 'user', iss: 'https://issuer.example', aud: 'client', exp: 1, iat: 1 },
      }),
    );
    await expect(client.signinSilent()).rejects.toThrow(/HTTPS/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('https://issuer.example/.well-known/openid-configuration');
    await expect(client.metadataService.getMetadata()).rejects.toThrow(/HTTPS/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

class NavigationTestManager extends WebCapacitorUserManager {
  async navigateFinalUrl(url: string, signout: boolean, secure = false) {
    const handle = { navigate: vi.fn().mockResolvedValue({ url }), close: vi.fn() };
    if (signout) {
      vi.spyOn(this._client, 'createSignoutRequest').mockResolvedValue({ url } as never);
      const result = this._signoutStart({}, handle);
      if (secure) await expect(result).resolves.toEqual({ url });
      else await expect(result).rejects.toThrow(/HTTPS/);
    } else {
      vi.spyOn(this._client, 'createSigninRequest').mockResolvedValue({ url, state: { id: 'state' } } as never);
      const result = this._signinStart({}, handle);
      if (secure) await expect(result).resolves.toEqual({ url });
      else await expect(result).rejects.toThrow(/HTTPS/);
    }
    expect(handle.navigate).toHaveBeenCalledTimes(secure ? 1 : 0);
    expect(handle.close).toHaveBeenCalledTimes(secure ? 0 : 1);
  }
}

it.each([false, true])('validates the final web navigation URL, signout=%s', async (signout) => {
  const client = manager();
  // Exercise the shared start hooks used by redirect, popup, and iframe navigation.
  await client.navigateFinalUrl('http://issuer.example/final?token=secret', signout);
});

it.each(accepted)('allows secure final sign-in and logout navigation to %s', async (url) => {
  await manager().navigateFinalUrl(url, false, true);
  await manager().navigateFinalUrl(url, true, true);
});

it('validates effective discovery after metadataSeed overrides', async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ token_endpoint: 'http://issuer.example/token' }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetch);
  const client = manager({ metadataSeed: { token_endpoint: 'https://issuer.example/token' } });
  expect(await client.metadataService.getTokenEndpoint()).toBe('https://issuer.example/token');
});
