import { type QuerySessionStatusArgs, type SessionStatus, type User } from 'oidc-client-ts';

import { CapacitorUserManager } from './capacitor-user-manager.js';
import type { ResolvedUserManagerConfiguration } from './configuration.js';

interface SessionMonitorLifecycle {
  start(user: User): Promise<void>;
  stop(): void;
}

interface InternalSessionMonitor {
  _start(user: User): Promise<void>;
  _stop(): void;
}

export class WebCapacitorUserManager extends CapacitorUserManager {
  private readonly sessionMonitor?: SessionMonitorLifecycle;
  private disposed = false;

  constructor(configuration: ResolvedUserManagerConfiguration) {
    super(configuration);
    this.sessionMonitor = this.captureSessionMonitor();
  }

  override async querySessionStatus(args: QuerySessionStatusArgs = {}): Promise<SessionStatus | null> {
    if (this.disposed) return null;
    const session = await super.querySessionStatus(args);
    return this.disposed ? null : session;
  }

  protected override disposePlatform(): Promise<void> {
    this.disposed = true;
    if (this.sessionMonitor) {
      this.events.removeUserLoaded(this.sessionMonitor.start);
      this.events.removeUserUnloaded(this.sessionMonitor.stop);
      this.sessionMonitor.stop();
    }
    return Promise.resolve();
  }

  private captureSessionMonitor(): SessionMonitorLifecycle | undefined {
    // oidc-client-ts does not expose public session-monitor lifecycle hooks.
    const monitor = this._sessionMonitor as unknown as InternalSessionMonitor | null;
    if (!monitor) return undefined;

    const originalStart = monitor._start;
    const stop = monitor._stop;
    const start = async (user: User) => {
      if (this.disposed) return;
      await originalStart(user);
      if (this.disposed) stop();
    };
    this.events.removeUserLoaded(originalStart);
    this.events.addUserLoaded(start);
    monitor._start = start;
    return { start, stop };
  }
}
