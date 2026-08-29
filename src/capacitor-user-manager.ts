import { CapacitorUserManager, setPlatformUserManagerFactory } from './base-capacitor-user-manager.js';
import { NativeCapacitorUserManager } from './native-capacitor-user-manager.js';
import { WebCapacitorUserManager } from './web-capacitor-user-manager.js';

setPlatformUserManagerFactory((configuration) =>
  configuration.platform === 'web'
    ? new WebCapacitorUserManager(configuration)
    : NativeCapacitorUserManager.fromConfiguration(configuration),
);

export { CapacitorUserManager };
