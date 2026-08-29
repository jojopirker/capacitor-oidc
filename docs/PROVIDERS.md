# Provider configuration

`capacitor-oidc` works with providers that support Authorization Code Flow with
PKCE for public clients and permit token-related requests from the configured
Capacitor origin.

## Provider checklist

For every provider:

1. Create a native, mobile, SPA, or other public client. Do not create or embed a
   client secret.
2. Enable Authorization Code Flow and PKCE with `S256`.
3. Register every web and native redirect and post-logout redirect URI exactly.
4. Enable refresh tokens and request the provider's offline-access scope if the
   app must renew sessions.
5. Allow the app's Capacitor origin through CORS for discovery, token, refresh,
   UserInfo, and revocation endpoints used by your configuration.
6. Use HTTPS for provider endpoints.

The recipes below identify the relevant authority and provider-console choices.
They do not replace the provider's own security guidance.

| Provider           | Current package validation                                      |
| ------------------ | --------------------------------------------------------------- |
| Amazon Cognito     | Basic login tested on a physical iOS device; edge cases remain. |
| Auth0              | Configuration guidance only.                                    |
| Keycloak           | Configuration guidance only.                                    |
| Okta               | Configuration guidance only.                                    |
| Microsoft Entra ID | Configuration guidance only.                                    |

## Amazon Cognito

Cognito separates the OIDC issuer from the managed-login domain. Use the user
pool issuer as `authority` and provide explicit metadata pointing browser-facing
endpoints at the managed-login domain:

```ts
const region = 'eu-central-1';
const userPoolId = 'eu-central-1_example';
const clientId = 'public-client-id';
const domain = 'https://example.auth.eu-central-1.amazoncognito.com';
const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

const manager = await CapacitorUserManager.create({
  common: {
    authority: issuer,
    client_id: clientId,
    scope: 'openid email profile aws.cognito.signin.user.admin',
    automaticSilentRenew: true,
    revokeTokensOnSignout: true,
    metadata: {
      issuer,
      authorization_endpoint: `${domain}/oauth2/authorize`,
      token_endpoint: `${domain}/oauth2/token`,
      userinfo_endpoint: `${domain}/oauth2/userInfo`,
      revocation_endpoint: `${domain}/oauth2/revoke`,
      end_session_endpoint: `${domain}/logout`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    },
  },
  web: {
    settings: { redirect_uri: 'https://app.example.com/oauth' },
    signoutArgs: {
      extraQueryParams: { client_id: clientId, logout_uri: 'https://app.example.com' },
    },
  },
  native: {
    settings: { redirect_uri: 'com.example.app://oauth' },
    signoutArgs: {
      extraQueryParams: { client_id: clientId, logout_uri: 'com.example.app://oauth' },
    },
  },
});
```

Configure the Cognito app client without a secret and register
`com.example.app://oauth` as an allowed callback and sign-out URL.

Cognito logout uses `logout_uri` instead of the standard
`post_logout_redirect_uri`. Leave `post_logout_redirect_uri` unset and configure
the platform-specific default arguments as above, or pass them for one call:

```ts
await manager.signout({
  extraQueryParams: {
    client_id: clientId,
    logout_uri: 'com.example.app://oauth',
  },
});
```

See the AWS documentation for the
[authorization endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html),
[token endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html),
and [logout endpoint](https://docs.aws.amazon.com/cognito/latest/developerguide/logout-endpoint.html).

## Auth0

Use the tenant or custom domain as the authority:

```ts
const settings = {
  authority: 'https://example.eu.auth0.com',
  client_id: 'native-application-client-id',
  redirect_uri: 'com.example.app:/callback',
  post_logout_redirect_uri: 'com.example.app:/logout-callback',
  scope: 'openid profile email offline_access',
  automaticSilentRenew: true,
};
```

Create a Native application, register both callback URLs, enable refresh-token
rotation as appropriate, and add the Capacitor origin to the allowed web origins
used for CORS.

See Auth0's [Capacitor quickstart](https://auth0.com/docs/quickstart/native/ionic-react)
and [refresh-token rotation guidance](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation).

## Keycloak

Use the realm URL as the authority:

```ts
const settings = {
  authority: 'https://identity.example.com/realms/example',
  client_id: 'mobile-app',
  redirect_uri: 'com.example.app:/callback',
  post_logout_redirect_uri: 'com.example.app:/logout-callback',
  scope: 'openid profile offline_access',
  automaticSilentRenew: true,
};
```

Create an OpenID Connect client with client authentication disabled, Standard
Flow enabled, an exact valid redirect URI, and the Capacitor origin in Web
Origins. Configure valid post-logout redirect URIs when using provider logout.

See the Keycloak documentation for
[managing OIDC clients](https://www.keycloak.org/docs/latest/server_admin/#_oidc_clients).

## Okta

Use the authorization-server issuer as the authority. For the default custom
authorization server this commonly has the following form:

```ts
const settings = {
  authority: 'https://example.okta.com/oauth2/default',
  client_id: 'native-application-client-id',
  redirect_uri: 'com.example.app:/callback',
  post_logout_redirect_uri: 'com.example.app:/logout-callback',
  scope: 'openid profile offline_access',
  automaticSilentRenew: true,
};
```

Create a Native Application integration, require PKCE, and register exact sign-in
and sign-out redirect URIs.

See Okta's guide to
[signing users into a mobile app with redirect](https://developer.okta.com/docs/guides/sign-into-mobile-app-redirect/).

## Microsoft Entra ID

Use a tenant-specific v2 issuer when the application belongs to one tenant:

```ts
const settings = {
  authority: 'https://login.microsoftonline.com/TENANT_ID/v2.0',
  client_id: 'application-client-id',
  redirect_uri: 'com.example.app:/callback',
  post_logout_redirect_uri: 'com.example.app:/logout-callback',
  scope: 'openid profile offline_access',
  automaticSilentRenew: true,
};
```

Configure a mobile and desktop application platform, register the native redirect
URI accepted by the app registration, and enable public-client flows required by
your tenant policy. Multi-tenant authorities and account selection require an
application-specific design rather than simply replacing `TENANT_ID` with a
shared authority.

See Microsoft Learn for
[mobile and desktop authentication flows](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-overview)
and [redirect URI restrictions](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

## Other providers

Start with the generic checklist and the provider's OpenID Connect discovery
document. If discovery does not describe a usable native flow, pass explicit
`metadata` through the upstream `UserManagerSettings` rather than adding
provider-specific code to this package.

Provider-specific compatibility reports and tested configuration examples are
welcome as focused contributions.
