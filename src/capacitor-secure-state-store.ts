import type { StateStore } from 'oidc-client-ts';

import { NativeOidc } from './native.js';

export class CapacitorSecureStateStore implements StateStore {
  constructor(private readonly namespace: string) {}

  async set(key: string, value: string): Promise<void> {
    await NativeOidc.storageSet({ namespace: this.namespace, key, value });
  }

  async get(key: string): Promise<string | null> {
    return (await NativeOidc.storageGet({ namespace: this.namespace, key })).value;
  }

  async remove(key: string): Promise<string | null> {
    return (await NativeOidc.storageRemove({ namespace: this.namespace, key })).value;
  }

  async getAllKeys(): Promise<string[]> {
    return (await NativeOidc.storageGetAllKeys({ namespace: this.namespace })).keys;
  }
}
