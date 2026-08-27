import { registerPlugin } from '@capacitor/core';

import type { CapacitorOidcPlugin } from './definitions.js';

export const NativeOidc = registerPlugin<CapacitorOidcPlugin>('CapacitorOidc');
