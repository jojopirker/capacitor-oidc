import type { CapacitorOidcErrorCode } from './definitions';
import { nativeContract } from './generated/native-contract';

export class CapacitorOidcError extends Error {
  constructor(
    public readonly code: CapacitorOidcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CapacitorOidcError';
  }
}

export function unsupported(feature: string): never {
  throw new CapacitorOidcError(
    nativeContract.errorCodes.unsupportedRuntime,
    `${feature} is not available in a native Capacitor runtime`,
  );
}
