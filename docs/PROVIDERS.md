# Provider configuration

The recipes below cover the settings that differ between providers.
`capacitor-oidc` does not contain provider-specific protocol code; it passes the
configured OpenID Connect settings to `oidc-client-ts`.

## Requirements

Use a public client that supports Authorization Code Flow with `S256` PKCE.
Register every web and native redirect URI and post-logout redirect URI exactly,
and configure the provider application without a client secret. A secret cannot
be kept in a Capacitor app.

If the app refreshes or revokes tokens, or loads UserInfo from the Capacitor
runtime, the provider must allow the configured Capacitor origin to call those
endpoints. Request `offline_access`, or the provider's equivalent, when the app
needs refresh tokens. Use HTTPS outside local test environments.

## Test status

The basic Amazon Cognito sign-in flow has been tested on a physical iOS device.
The Auth0, Keycloak, Okta, and Microsoft Entra ID sections document expected
configuration, but those recipes are not yet covered by the package's provider
integration tests.

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

Start with the requirements above and the provider's OpenID Connect discovery
document. If discovery does not describe a usable native flow, pass explicit
`metadata` through the upstream `UserManagerSettings` rather than adding
provider-specific code to this package.

Provider-specific compatibility reports and tested configuration examples are
welcome as focused contributions.
