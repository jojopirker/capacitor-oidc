import { type QuerySessionStatusArgs, type SessionStatus } from 'oidc-client-ts';

import { CapacitorUserManager, type ManagerImplementationToken } from './capacitor-user-manager.js';
import type { ResolvedUserManagerConfiguration } from './configuration.js';
import { manageSessionMonitor, type ManagedSessionMonitor } from './oidc-session-monitor.js';

export class WebCapacitorUserManager extends CapacitorUserManager {
  private readonly sessionMonitor?: ManagedSessionMonitor;
  private disposed = false;

  constructor(configuration: ResolvedUserManagerConfiguration, implementation: ManagerImplementationToken) {
    super(implementation, configuration);
    this.sessionMonitor = manageSessionMonitor(this._sessionMonitor, this.events, () => this.disposed);
  }

  override async querySessionStatus(args: QuerySessionStatusArgs = {}): Promise<SessionStatus | null> {
    if (this.disposed) return null;
    const session = await super.querySessionStatus(args);
    return this.disposed ? null : session;
  }

  protected override disposePlatform(): Promise<void> {
    this.disposed = true;
    this.sessionMonitor?.dispose();
    return Promise.resolve();
  }
}
