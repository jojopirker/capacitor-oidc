import type { StateStore } from 'oidc-client-ts';

import { nativeContract } from './generated/native-contract';
import { NativeOidc } from './native';

export class CapacitorSecureStateStore implements StateStore {
  constructor(private readonly namespace: string) {}

  async set(key: string, value: string): Promise<void> {
    await NativeOidc.storageSet({
      [nativeContract.fields.namespace]: this.namespace,
      [nativeContract.fields.key]: key,
      [nativeContract.fields.value]: value,
    });
  }

  async get(key: string): Promise<string | null> {
    const result = await NativeOidc.storageGet({
      [nativeContract.fields.namespace]: this.namespace,
      [nativeContract.fields.key]: key,
    });
    return result[nativeContract.fields.value];
  }

  async remove(key: string): Promise<string | null> {
    const result = await NativeOidc.storageRemove({
      [nativeContract.fields.namespace]: this.namespace,
      [nativeContract.fields.key]: key,
    });
    return result[nativeContract.fields.value];
  }

  async getAllKeys(): Promise<string[]> {
    const result = await NativeOidc.storageGetAllKeys({
      [nativeContract.fields.namespace]: this.namespace,
    });
    return result[nativeContract.fields.keys];
  }
}
