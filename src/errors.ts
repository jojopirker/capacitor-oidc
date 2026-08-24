import type { CapacitorOidcErrorCode } from './definitions';

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
  throw new CapacitorOidcError('UNSUPPORTED_RUNTIME', `${feature} is not available in a native Capacitor runtime`);
}
