import { useEffect, useRef, useState } from 'react';
import type { CapacitorUserManager, User } from 'capacitor-oidc';

import { completeWebCallback, getUserManager } from './auth';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function App() {
  const auth = useRef<CapacitorUserManager | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Restoring the stored session…');
  const displayName = user?.profile.preferred_username ?? user?.profile.name ?? user?.profile.sub;

  useEffect(() => {
    let active = true;
    let manager: CapacitorUserManager | undefined;
    const userLoaded = (loadedUser: User) => {
      if (!active) return;
      setUser(loadedUser);
      setMessage('The session was stored.');
    };
    const userUnloaded = () => {
      if (!active) return;
      setUser(null);
      setMessage('The session was cleared.');
    };

    void getUserManager()
      .then(async (currentManager) => {
        if (!active) return;
        manager = currentManager;
        auth.current = currentManager;
        currentManager.events.addUserLoaded(userLoaded);
        currentManager.events.addUserUnloaded(userUnloaded);

        await completeWebCallback(currentManager);
        const storedUser = await currentManager.getUser();
        if (!active) return;
        setUser(storedUser);
        setMessage(storedUser ? 'The stored session is ready.' : 'No local session is stored.');
      })
      .catch((error: unknown) => {
        if (active) setMessage(errorMessage(error));
      });

    return () => {
      active = false;
      auth.current = null;
      manager?.events.removeUserLoaded(userLoaded);
      manager?.events.removeUserUnloaded(userUnloaded);
    };
  }, []);

  function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    setMessage(label);
    void action()
      .catch((error: unknown) => setMessage(errorMessage(error)))
      .finally(() => setBusy(false));
  }

  function signin() {
    const manager = auth.current;
    if (manager) run('Opening the identity provider…', () => manager.signin());
  }

  function renew() {
    const manager = auth.current;
    if (!manager) return;

    run('Renewing the session…', async () => {
      const renewedUser = await manager.getValidUser(60);
      setUser(renewedUser);
      setMessage(renewedUser ? 'The access token is ready.' : 'No renewable session was found.');
    });
  }

  function signout() {
    const manager = auth.current;
    if (manager) run('Signing out at the identity provider…', () => manager.signout());
  }

  return (
    <main>
      <section className="card" aria-labelledby="title">
        <p className="eyebrow">React + Capacitor</p>
        <h1 id="title">OpenID Connect, one manager</h1>
        <p className="summary">The same session API runs in the browser and in the native Capacitor shell.</p>

        <div className="session" aria-live="polite">
          <span className={`status-dot${user ? ' active' : ''}`} aria-hidden="true" />
          <div>
            <strong>{user ? `Signed in as ${displayName}` : 'Signed out'}</strong>
            <p>{message}</p>
          </div>
        </div>

        <div className="actions">
          <button disabled={busy || !auth.current || Boolean(user)} onClick={signin}>
            Sign in
          </button>
          <button className="secondary" disabled={busy || !user} onClick={renew}>
            Renew
          </button>
          <button className="secondary" disabled={busy || !user} onClick={signout}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
