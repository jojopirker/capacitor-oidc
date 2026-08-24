import { registerPlugin } from '@capacitor/core';

import type { CapacitorOidcPlugin } from './definitions';

export const NativeOidc = registerPlugin<CapacitorOidcPlugin>('CapacitorOidc');
