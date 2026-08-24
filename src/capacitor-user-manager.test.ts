import { User, UserManager } from 'oidc-client-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CapacitorUserManager } from './capacitor-user-manager';

const { setSessionSnapshot, storage } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  setSessionSnapshot: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async () => ({ remove: vi.fn() })),
  },
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    configure: vi.fn(),
    cancel: vi.fn(),
    storageSet: async ({ namespace, key, value }: { namespace: string; key: string; value: string }) => {
      storage.set(`${namespace}:${key}`, value);
    },
    storageGet: async ({ namespace, key }: { namespace: string; key: string }) => ({
      value: storage.get(`${namespace}:${key}`) ?? null,
    }),
    storageRemove: async ({ namespace, key }: { namespace: string; key: string }) => {
      const storageKey = `${namespace}:${key}`;
      const value = storage.get(storageKey) ?? null;
      storage.delete(storageKey);
      return { value };
    },
    storageGetAllKeys: async () => ({ keys: [] }),
    setSessionSnapshot,
  }),
}));

const settings = {
  authority: 'https://issuer.example',
  client_id: 'mobile',
  redirect_uri: 'com.example.app:/callback',
  post_logout_redirect_uri: 'com.example.app:/logout',
  automaticSilentRenew: false,
};

describe('CapacitorUserManager', () => {
  beforeEach(() => {
    storage.clear();
    setSessionSnapshot.mockClear();
  });

  it('updates and clears the native widget snapshot through upstream storage paths', async () => {
    const manager = await CapacitorUserManager.create(settings);
    const user = new User({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1_800_000_000,
    });

    await manager.storeUser(user);
    expect(JSON.parse(setSessionSnapshot.mock.lastCall?.[0].value)).toMatchObject({
      version: 1,
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    await manager.removeUser();
    expect(setSessionSnapshot).toHaveBeenLastCalledWith({ namespace: 'default', value: null });
    await manager.dispose();
  });

  it('shares one refresh request between concurrent callers', async () => {
    const manager = await CapacitorUserManager.create(settings);
    const user = new User({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    await manager.storeUser(user);

    let resolveRefresh!: (value: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const spy = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const first = manager.signinSilent();
    const second = manager.signinSilent();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    resolveRefresh(user);
    await expect(Promise.all([first, second])).resolves.toEqual([user, user]);
    spy.mockRestore();
    await manager.dispose();
  });

  it('keeps renewal available when signout fails before local removal', async () => {
    const manager = await CapacitorUserManager.create(settings);
    const signout = vi.spyOn(UserManager.prototype, 'signoutPopup').mockRejectedValue(new Error('revocation failed'));
    const stopRenewal = vi.spyOn(UserManager.prototype, 'stopSilentRenew');

    await expect(manager.signout()).rejects.toThrow('revocation failed');
    expect(stopRenewal).not.toHaveBeenCalled();

    signout.mockRestore();
    stopRenewal.mockRestore();
    await manager.dispose();
  });
});
