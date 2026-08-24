import { registerPlugin } from '@capacitor/core';

import type { CapacitorOidcPlugin } from './definitions';
import { nativeContract } from './generated/native-contract';

export const NativeOidc = registerPlugin<CapacitorOidcPlugin>(nativeContract.pluginName);
