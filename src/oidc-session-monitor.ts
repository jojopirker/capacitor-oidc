import type { SessionMonitor, User, UserManagerEvents } from 'oidc-client-ts';

type SessionMonitorUser =
  | User
  | {
      session_state: string;
      profile: { sub: string } | null;
    };

interface SessionMonitorInternals {
  _start(user: SessionMonitorUser): Promise<void>;
  _stop(): void;
}

export interface ManagedSessionMonitor {
  dispose(): void;
}

export function manageSessionMonitor(
  sessionMonitor: SessionMonitor | null,
  events: UserManagerEvents,
  isDisposed: () => boolean,
): ManagedSessionMonitor | undefined {
  // oidc-client-ts 3.5.0 has no public session-monitor teardown API.
  const monitor = sessionMonitor as unknown as SessionMonitorInternals | null;
  if (!monitor) return undefined;

  const originalStart = monitor._start;
  const stop = monitor._stop;
  const start = async (user: SessionMonitorUser) => {
    if (isDisposed()) return;
    await originalStart(user);
    if (isDisposed()) stop();
  };

  events.removeUserLoaded(originalStart);
  events.addUserLoaded(start);
  monitor._start = start;

  return {
    dispose() {
      events.removeUserLoaded(start);
      events.removeUserUnloaded(stop);
      stop();
    },
  };
}
