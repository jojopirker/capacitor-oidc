import { describe, expect, it } from 'vitest';

import { resolveConfiguration } from './configuration';
import type { CapacitorUserManagerConfiguration } from './definitions';

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
      response_type: 'code',
      disablePKCE: false,
    });
    expect(resolved.signinMode).toBe('redirect');
    expect(resolved.signoutMode).toBe('redirect');
    expect(resolved.nativeOptions).toBeUndefined();
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
});
