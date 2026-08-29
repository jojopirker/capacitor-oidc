import type { ResolvedUserManagerConfiguration } from '../../src/configuration.js';
import { CapacitorUserManager, type CapacitorSigninArgs, type CapacitorSignoutArgs } from '../../src/index.js';

const signinArgs = { prompt: 'login', state: { returnTo: '/' } } satisfies CapacitorSigninArgs;
const signoutArgs = { id_token_hint: 'id-token', state: { source: 'menu' } } satisfies CapacitorSignoutArgs;

// @ts-expect-error Portable sign-in does not accept popup navigation controls.
const popupSigninArgs = { popupWindowTarget: '_blank' } satisfies CapacitorSigninArgs;
// @ts-expect-error Portable sign-in does not accept redirect navigation controls.
const redirectSigninArgs = { redirectMethod: 'replace' } satisfies CapacitorSigninArgs;
// @ts-expect-error Portable sign-out does not accept popup navigation controls.
const popupSignoutArgs = { popupSignal: null } satisfies CapacitorSignoutArgs;
// @ts-expect-error Portable sign-out does not accept redirect navigation controls.
const redirectSignoutArgs = { redirectTarget: 'top' } satisfies CapacitorSignoutArgs;

class ExternalManager extends CapacitorUserManager {
  constructor(configuration: ResolvedUserManagerConfiguration) {
    // @ts-expect-error Manager implementations require the package-private construction token.
    super({}, configuration);
  }

  protected disposePlatform(): Promise<void> {
    return Promise.resolve();
  }
}

void [
  signinArgs,
  signoutArgs,
  popupSigninArgs,
  redirectSigninArgs,
  popupSignoutArgs,
  redirectSignoutArgs,
  ExternalManager,
];
