import { readFileSync } from 'node:fs';
import { ErrorResponse, User, UserManager } from 'oidc-client-ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CapacitorUserManager } from './capacitor-user-manager';
import type {
  CapacitorNativeUserManagerSettings,
  CapacitorOidcNativeOptions,
  CapacitorUserManagerCommonSettings,
  CapacitorUserManagerConfiguration,
} from './definitions';

const storedSessionFixture = JSON.parse(
  readFileSync(new URL('../contracts/fixtures/stored-session-v1.json', import.meta.url), 'utf8'),
);

const { addListener, appState, cancel, configure, runtime, setSessionSnapshot, storage, storageGet } = vi.hoisted(
  () => {
    const storage = new Map<string, string>();
    return {
      addListener: vi.fn(),
      appState: {
        listener: undefined as ((state: { isActive: boolean }) => void) | undefined,
        remove: vi.fn(),
      },
      cancel: vi.fn(),
      configure: vi.fn(),
      runtime: { platform: 'ios' },
      storage,
      setSessionSnapshot: vi.fn(),
      storageGet: vi.fn(async ({ namespace, key }: { namespace: string; key: string }) => ({
        value: storage.get(`${namespace}:${key}`) ?? null,
      })),
    };
  },
);

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: addListener.mockImplementation(
      async (_eventName: string, listener: (state: { isActive: boolean }) => void) => {
        appState.listener = listener;
        return { remove: appState.remove };
      },
    ),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => runtime.platform,
  },
  registerPlugin: () => ({
    configure,
    cancel,
    storageSet: async ({ namespace, key, value }: { namespace: string; key: string; value: string }) => {
      storage.set(`${namespace}:${key}`, value);
    },
    storageGet,
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

const automaticSettings = { ...settings, automaticSilentRenew: true };
const futureExpiration = Math.floor(Date.now() / 1000) + 3_600;

type NativeTestSettings = CapacitorUserManagerCommonSettings & CapacitorNativeUserManagerSettings;

function nativeConfiguration(
  settings: NativeTestSettings,
  options?: CapacitorOidcNativeOptions,
): CapacitorUserManagerConfiguration {
  const { post_logout_redirect_uri, redirect_uri, ...common } = settings;
  return {
    common,
    native: {
      settings: { post_logout_redirect_uri, redirect_uri },
      options,
    },
  };
}

function storedUserKey(namespace = 'default'): string {
  return `${namespace}.session:user:${settings.authority}:${settings.client_id}`;
}

function restoreOnCreate(user: User, namespace = 'default'): void {
  storage.set(storedUserKey(namespace), user.toStorageString());
}

describe('CapacitorUserManager', () => {
  beforeEach(() => {
    runtime.platform = 'ios';
    storage.clear();
    storageGet.mockClear();
    setSessionSnapshot.mockClear();
    addListener.mockClear();
    cancel.mockClear();
    configure.mockClear();
    appState.listener = undefined;
    appState.remove.mockClear();
  });

  it('returns the manager without waiting for startup renewal', async () => {
    const expiredUser = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    const renewedUser = new User({
      access_token: 'renewed-access',
      refresh_token: 'rotated-refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: futureExpiration,
    });
    restoreOnCreate(expiredUser);

    let resolveRefresh!: (user: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const concurrentRefresh = manager.signinSilent();
    expect(refresh).toHaveBeenCalledTimes(1);
    resolveRefresh(renewedUser);
    await expect(concurrentRefresh).resolves.toBe(renewedUser);

    refresh.mockRestore();
    await manager.dispose();
  });

  it('waits for startup renewal before removing the local user', async () => {
    const user = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    let resolveRefresh!: (user: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const removal = manager.removeUser();
    await Promise.resolve();
    expect(storage.has(storedUserKey())).toBe(true);

    resolveRefresh(user);
    await removal;
    expect(storage.has(storedUserKey())).toBe(false);

    refresh.mockRestore();
    await manager.dispose();
  });

  it('waits for the entire automatic check before removing the local user', async () => {
    const user = new User({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: futureExpiration,
    });
    restoreOnCreate(user);
    let resolveCheck!: (user: User | null) => void;
    const automaticCheck = new Promise<User | null>((resolve) => {
      resolveCheck = resolve;
    });
    const getValidUser = vi.spyOn(CapacitorUserManager.prototype, 'getValidUser').mockReturnValue(automaticCheck);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    expect(getValidUser).toHaveBeenCalledTimes(1);

    let removed = false;
    const removal = manager.removeUser().then(() => {
      removed = true;
    });
    await Promise.resolve();
    expect(removed).toBe(false);

    resolveCheck(user);
    await removal;
    expect(storage.has(storedUserKey())).toBe(false);

    getValidUser.mockRestore();
    await manager.dispose();
  });

  it('waits for startup renewal before starting signout', async () => {
    const user = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    let resolveRefresh!: (user: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);
    const signout = vi.spyOn(UserManager.prototype, 'signoutPopup').mockResolvedValue();

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const signingOut = manager.signout();
    await Promise.resolve();
    expect(signout).not.toHaveBeenCalled();

    resolveRefresh(user);
    await signingOut;
    expect(signout).toHaveBeenCalledTimes(1);

    refresh.mockRestore();
    signout.mockRestore();
    await manager.dispose();
  });

  it('waits for startup renewal before starting interactive signin', async () => {
    const storedUser = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'old-subject' },
      expires_at: 1,
    });
    const signedInUser = new User({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      token_type: 'Bearer',
      profile: { sub: 'new-subject' },
      expires_at: futureExpiration,
    });
    restoreOnCreate(storedUser);
    let resolveRefresh!: (user: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);
    const signin = vi.spyOn(UserManager.prototype, 'signinPopup').mockResolvedValue(signedInUser);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const signingIn = manager.signin();
    await Promise.resolve();
    expect(signin).not.toHaveBeenCalled();

    resolveRefresh(storedUser);
    await expect(signingIn).resolves.toBeUndefined();
    expect(signin).toHaveBeenCalledTimes(1);

    refresh.mockRestore();
    signin.mockRestore();
    await manager.dispose();
  });

  it('waits for startup renewal before disposal completes', async () => {
    const user = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    let resolveRefresh!: (user: User) => void;
    const upstreamRefresh = new Promise<User>((resolve) => {
      resolveRefresh = resolve;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    let disposed = false;
    const disposal = manager.dispose().then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);

    resolveRefresh(user);
    await disposal;
    expect(disposed).toBe(true);

    refresh.mockRestore();
  });

  it('does not refresh a valid restored user', async () => {
    const user = new User({
      access_token: 'access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: futureExpiration,
    });
    restoreOnCreate(user);
    const getValidUser = vi.spyOn(CapacitorUserManager.prototype, 'getValidUser');
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent');

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(getValidUser).toHaveBeenCalledTimes(1));
    await getValidUser.mock.results[0].value;

    expect(refresh).not.toHaveBeenCalled();
    getValidUser.mockRestore();
    refresh.mockRestore();
    await manager.dispose();
  });

  it('does not check startup or resume renewal when automatic renewal is disabled', async () => {
    const getValidUser = vi.spyOn(CapacitorUserManager.prototype, 'getValidUser');
    const manager = await CapacitorUserManager.create(nativeConfiguration(settings));

    appState.listener?.({ isActive: true });

    expect(getValidUser).not.toHaveBeenCalled();
    getValidUser.mockRestore();
    await manager.dispose();
  });

  it('checks renewal when an automatically renewing manager resumes', async () => {
    const getValidUser = vi.spyOn(CapacitorUserManager.prototype, 'getValidUser');
    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    await vi.waitFor(() => expect(getValidUser).toHaveBeenCalledTimes(1));
    await getValidUser.mock.results[0].value;
    await Promise.resolve();

    appState.listener?.({ isActive: false });
    expect(getValidUser).toHaveBeenCalledTimes(1);

    appState.listener?.({ isActive: true });
    expect(getValidUser).toHaveBeenCalledTimes(2);

    getValidUser.mockRestore();
    await manager.dispose();
  });

  it('reports startup renewal errors without removing a usable refresh token', async () => {
    const user = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    const error = new Error('network unavailable');
    let rejectRefresh!: (error: Error) => void;
    const upstreamRefresh = new Promise<User>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    const silentRenewError = vi.fn();
    const removeListener = manager.events.addSilentRenewError(silentRenewError);
    rejectRefresh(error);
    await vi.waitFor(() => expect(silentRenewError).toHaveBeenCalledWith(error));

    expect(storage.get(storedUserKey())).toBe(user.toStorageString());
    removeListener();
    refresh.mockRestore();
    await manager.dispose();
  });

  it('removes the restored user when startup renewal returns invalid_grant', async () => {
    const user = new User({
      access_token: 'expired-access',
      refresh_token: 'refresh',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    const error = new ErrorResponse({ error: 'invalid_grant' });
    let rejectRefresh!: (error: ErrorResponse) => void;
    const upstreamRefresh = new Promise<User>((_resolve, reject) => {
      rejectRefresh = reject;
    });
    const refresh = vi.spyOn(UserManager.prototype, 'signinSilent').mockReturnValue(upstreamRefresh);

    const manager = await CapacitorUserManager.create(nativeConfiguration(automaticSettings));
    const silentRenewError = vi.fn();
    const removeListener = manager.events.addSilentRenewError(silentRenewError);
    rejectRefresh(error);
    await vi.waitFor(() => expect(silentRenewError).toHaveBeenCalledWith(error));

    expect(storage.has(storedUserKey())).toBe(false);
    expect(setSessionSnapshot).toHaveBeenLastCalledWith({ namespace: 'default', value: null });
    removeListener();
    refresh.mockRestore();
    await manager.dispose();
  });

  it('still rejects creation when secure local state cannot be restored', async () => {
    const error = new Error('secure storage unavailable');
    storageGet.mockRejectedValueOnce(error);

    await expect(CapacitorUserManager.create(nativeConfiguration(settings))).rejects.toBe(error);
  });

  it('removes an expired user without a refresh token', async () => {
    const user = new User({
      access_token: 'expired-access',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
      expires_at: 1,
    });
    restoreOnCreate(user);
    const manager = await CapacitorUserManager.create(nativeConfiguration(settings));

    await expect(manager.getValidUser()).resolves.toBeNull();

    expect(storage.has(storedUserKey())).toBe(false);
    expect(setSessionSnapshot).toHaveBeenLastCalledWith({ namespace: 'default', value: null });
    await manager.dispose();
  });

  it('updates and clears the native widget snapshot through upstream storage paths', async () => {
    const manager = await CapacitorUserManager.create(nativeConfiguration(settings));
    const user = new User({
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id-token',
      token_type: 'Bearer',
      scope: 'openid profile offline_access',
      profile: { sub: 'subject' },
      expires_at: 1_800_000_000,
    });

    await manager.storeUser(user);
    expect(JSON.parse(setSessionSnapshot.mock.lastCall?.[0].value)).toEqual(storedSessionFixture);

    await manager.removeUser();
    expect(setSessionSnapshot).toHaveBeenLastCalledWith({ namespace: 'default', value: null });
    await manager.dispose();
  });

  it('shares one refresh request between concurrent callers', async () => {
    const manager = await CapacitorUserManager.create(nativeConfiguration(settings));
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

  it('stores the explicit metadata issuer in the widget snapshot', async () => {
    const manager = await CapacitorUserManager.create(
      nativeConfiguration({
        ...settings,
        authority: 'https://discovery.example',
        metadata: { issuer: 'https://issuer.example' },
      }),
    );
    const user = new User({
      access_token: 'access',
      token_type: 'Bearer',
      profile: { sub: 'subject' },
    });

    await manager.storeUser(user);
    expect(JSON.parse(setSessionSnapshot.mock.lastCall?.[0].value)).toMatchObject({
      issuer: 'https://issuer.example',
    });
    await manager.dispose();
  });

  it('keeps renewal available when signout fails before local removal', async () => {
    const manager = await CapacitorUserManager.create(nativeConfiguration(settings));
    const signout = vi.spyOn(UserManager.prototype, 'signoutPopup').mockRejectedValue(new Error('revocation failed'));
    const stopRenewal = vi.spyOn(UserManager.prototype, 'stopSilentRenew');

    await expect(manager.signout()).rejects.toThrow('revocation failed');
    expect(stopRenewal).not.toHaveBeenCalled();

    signout.mockRestore();
    stopRenewal.mockRestore();
    await manager.dispose();
  });

  it('forwards provider-specific signout arguments unchanged', async () => {
    const manager = await CapacitorUserManager.create(
      nativeConfiguration({
        authority: settings.authority,
        client_id: settings.client_id,
        redirect_uri: settings.redirect_uri,
        automaticSilentRenew: false,
      }),
    );
    const args = {
      extraQueryParams: {
        client_id: 'mobile',
        logout_uri: 'com.example.app:/logout',
      },
      id_token_hint: 'id-token',
      state: { source: 'native' },
    };
    const signout = vi.spyOn(UserManager.prototype, 'signoutPopup').mockResolvedValue();

    await manager.signout(args);

    expect(signout).toHaveBeenCalledWith(args);
    signout.mockRestore();
    await manager.dispose();
  });

  it('uses redirect navigation and browser callbacks on web', async () => {
    runtime.platform = 'web';
    const signedInUser = new User({
      access_token: 'web-access',
      token_type: 'Bearer',
      profile: { sub: 'web-subject' },
      expires_at: futureExpiration,
    });
    const signinRedirect = vi.spyOn(UserManager.prototype, 'signinRedirect').mockResolvedValue();
    const signinCallback = vi.spyOn(UserManager.prototype, 'signinCallback').mockResolvedValue(signedInUser);
    const signoutRedirect = vi.spyOn(UserManager.prototype, 'signoutRedirect').mockResolvedValue();
    const manager = await CapacitorUserManager.create({
      common: {
        authority: settings.authority,
        client_id: 'web',
        automaticSilentRenew: false,
      },
      web: {
        settings: {
          redirect_uri: 'https://app.example/callback',
          post_logout_redirect_uri: 'https://app.example/logout',
        },
        signinArgs: { state: { returnTo: '/dashboard' } },
        signoutArgs: { state: { source: 'menu' } },
      },
    });

    await manager.signin({ prompt: 'login' });
    await expect(manager.signinCallback('https://app.example/callback?code=code')).resolves.toBe(signedInUser);
    await manager.signout({ id_token_hint: 'id-token' });

    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/dashboard' }, prompt: 'login' });
    expect(signinCallback).toHaveBeenCalledWith('https://app.example/callback?code=code');
    expect(signoutRedirect).toHaveBeenCalledWith({ state: { source: 'menu' }, id_token_hint: 'id-token' });
    expect(configure).not.toHaveBeenCalled();
    expect(addListener).not.toHaveBeenCalled();

    signinRedirect.mockRestore();
    signinCallback.mockRestore();
    signoutRedirect.mockRestore();
    await manager.dispose();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('supports popup interaction and browser storage without native side effects', async () => {
    runtime.platform = 'web';
    const user = new User({
      access_token: 'web-access',
      token_type: 'Bearer',
      profile: { sub: 'web-subject' },
      expires_at: futureExpiration,
    });
    const signinPopup = vi.spyOn(UserManager.prototype, 'signinPopup').mockResolvedValue(user);
    const signoutPopup = vi.spyOn(UserManager.prototype, 'signoutPopup').mockResolvedValue();
    const manager = await CapacitorUserManager.create({
      common: {
        authority: settings.authority,
        client_id: 'web-popup',
        automaticSilentRenew: false,
      },
      web: {
        settings: {
          redirect_uri: 'https://app.example/popup-callback',
          post_logout_redirect_uri: 'https://app.example/popup-logout-callback',
        },
        signinMode: 'popup',
        signoutMode: 'popup',
      },
    });

    await manager.signin();
    await manager.storeUser(user);
    await manager.signout();

    expect(signinPopup).toHaveBeenCalledOnce();
    expect(signoutPopup).toHaveBeenCalledOnce();
    expect(setSessionSnapshot).not.toHaveBeenCalled();

    signinPopup.mockRestore();
    signoutPopup.mockRestore();
    await manager.dispose();
  });

  it('stops web session monitoring during disposal', async () => {
    runtime.platform = 'web';
    const manager = await CapacitorUserManager.create({
      common: {
        authority: settings.authority,
        client_id: 'web-monitored',
        automaticSilentRenew: false,
      },
      web: {
        settings: {
          redirect_uri: 'https://app.example/callback',
          monitorSession: true,
        },
      },
    });
    const sessionMonitor = (
      manager as unknown as {
        sessionMonitor: { stop(): void };
      }
    ).sessionMonitor;
    const stop = vi.spyOn(sessionMonitor, 'stop');

    await manager.dispose();

    expect(stop).toHaveBeenCalledOnce();
  });

  it('does not restart web session monitoring when initialization finishes after disposal', async () => {
    runtime.platform = 'web';
    const reads: ((value: string | null) => void)[] = [];
    const userStore = {
      set: async () => undefined,
      get: vi.fn(
        () =>
          new Promise<string | null>((resolve) => {
            reads.push(resolve);
          }),
      ),
      remove: async () => null,
      getAllKeys: async () => [],
    };
    const creation = CapacitorUserManager.create({
      common: {
        authority: settings.authority,
        client_id: 'web-delayed-monitor',
        automaticSilentRenew: false,
      },
      web: {
        settings: {
          redirect_uri: 'https://app.example/callback',
          monitorSession: true,
          userStore,
        },
      },
    });
    await vi.waitFor(() => expect(reads).toHaveLength(2));
    reads[1](null);
    const manager = await creation;
    const getCheckSessionIframe = vi
      .spyOn(manager.metadataService, 'getCheckSessionIframe')
      .mockResolvedValue('https://issuer.example/check-session');

    await manager.dispose();
    const user = new User({
      access_token: 'web-access',
      token_type: 'Bearer',
      profile: { sub: 'web-subject' },
      session_state: 'session-state',
      expires_at: futureExpiration,
    });
    reads[0](user.toStorageString());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getCheckSessionIframe).not.toHaveBeenCalled();
  });
});
