import { describe, expect, it } from 'vitest';

import { resolveConfiguration, resolveLegacyNativeConfiguration } from './configuration';
import type { CapacitorUserManagerConfiguration, CapacitorUserManagerSettings } from './definitions';

const common = {
  authority: 'https://issuer.example',
  client_id: 'app',
  scope: 'openid profile',
  automaticSilentRenew: true,
};

describe('resolveConfiguration', () => {
  it('layers an iOS override over shared native configuration', () => {
    const resolved = resolveConfiguration(
      {
        common,
        native: {
          settings: {
            redirect_uri: 'com.example.app:/callback',
            post_logout_redirect_uri: 'com.example.app:/logout',
          },
          options: {
            storageNamespace: 'primary',
            prefersEphemeralWebBrowserSession: false,
          },
          signinArgs: { prompt: 'select_account' },
        },
        ios: {
          settings: { redirect_uri: 'com.example.ios:/callback' },
          options: {
            prefersEphemeralWebBrowserSession: true,
            ios: { keychainAccessGroup: 'group.example.app' },
          },
          signinArgs: { prompt: 'login' },
        },
      },
      'ios',
    );

    expect(resolved.settings).toMatchObject({
      authority: common.authority,
      client_id: common.client_id,
      redirect_uri: 'com.example.ios:/callback',
      post_logout_redirect_uri: 'com.example.app:/logout',
      response_type: 'code',
      disablePKCE: false,
      monitorSession: false,
    });
    expect(resolved.nativeOptions).toEqual({
      storageNamespace: 'primary',
      prefersEphemeralWebBrowserSession: true,
      ios: { keychainAccessGroup: 'group.example.app' },
    });
    expect(resolved.signinArgs).toEqual({ prompt: 'login' });
  });

  it('keeps browser-only settings and defaults to redirects on web', () => {
    const userStore = {
      set: async () => undefined,
      get: async () => null,
      remove: async () => null,
      getAllKeys: async () => [],
    };
    const resolved = resolveConfiguration(
      {
        common,
        web: {
          settings: {
            redirect_uri: 'https://app.example/callback',
            silent_redirect_uri: 'https://app.example/silent-callback',
            monitorSession: true,
            userStore,
          },
        },
      },
      'web',
    );

    expect(resolved.settings).toMatchObject({
      redirect_uri: 'https://app.example/callback',
      silent_redirect_uri: 'https://app.example/silent-callback',
      monitorSession: true,
      userStore,
    });
    expect(resolved.settings).not.toHaveProperty('response_type');
    expect(resolved.settings).not.toHaveProperty('disablePKCE');
    expect(resolved.signinMode).toBe('redirect');
    expect(resolved.signoutMode).toBe('redirect');
    expect(resolved.nativeOptions).toBeUndefined();
  });

  it('leaves popup callback defaults to oidc-client-ts', () => {
    const resolved = resolveConfiguration(
      {
        common,
        web: {
          settings: {
            redirect_uri: 'https://app.example/callback',
            post_logout_redirect_uri: 'https://app.example/logout-callback',
          },
          signinMode: 'popup',
          signoutMode: 'popup',
        },
      },
      'web',
    );

    expect(resolved.settings).not.toHaveProperty('popup_redirect_uri');
    expect(resolved.settings).not.toHaveProperty('popup_post_logout_redirect_uri');
  });

  it('requires configuration for the current runtime', () => {
    expect(() => resolveConfiguration({ common, native: undefined }, 'web')).toThrow(
      'No web configuration was provided',
    );
    expect(() => resolveConfiguration({ common, web: undefined }, 'android')).toThrow(
      'No android configuration was provided',
    );
  });

  it('rejects unsafe public-client and native-only settings at runtime', () => {
    const secretConfiguration = {
      common: { ...common, client_secret: 'secret' },
      web: { settings: { redirect_uri: 'https://app.example/callback' } },
    } as CapacitorUserManagerConfiguration;
    const customNativeStore = {
      common,
      native: {
        settings: {
          redirect_uri: 'com.example.app:/callback',
          userStore: {},
        },
      },
    } as CapacitorUserManagerConfiguration;

    expect(() => resolveConfiguration(secretConfiguration, 'web')).toThrow('client_secret');
    expect(() => resolveConfiguration(customNativeStore, 'android')).toThrow('userStore');
  });

  it('resolves the legacy native settings and options', () => {
    const legacySettings: CapacitorUserManagerSettings = {
      ...common,
      redirect_uri: 'com.example.app:/callback',
      post_logout_redirect_uri: 'com.example.app:/logout',
    };
    const resolved = resolveLegacyNativeConfiguration(
      legacySettings,
      { storageNamespace: 'legacy', prefersEphemeralWebBrowserSession: true },
      'ios',
    );

    expect(resolved.settings).toMatchObject({
      ...legacySettings,
      response_type: 'code',
      disablePKCE: false,
      monitorSession: false,
    });
    expect(resolved.nativeOptions).toEqual({
      storageNamespace: 'legacy',
      prefersEphemeralWebBrowserSession: true,
    });
    expect(resolved.signinMode).toBe('popup');
    expect(resolved.signoutMode).toBe('popup');
  });

  it('does not interpret legacy native settings as web configuration', () => {
    expect(() =>
      resolveLegacyNativeConfiguration({ ...common, redirect_uri: 'com.example.app:/callback' }, {}, 'web'),
    ).toThrow('only supported on iOS and Android');
  });
});
