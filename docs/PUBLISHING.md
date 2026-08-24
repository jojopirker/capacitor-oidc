# Publishing

The first bootstrap prerelease may be published manually under the `next` tag to
create the registry package and configure trusted publishing. It is not a stable
release.

The release workflow uses npm trusted publishing so GitHub exchanges a short-lived
OIDC identity for publish access. It does not use an npm token. Stable releases use
the `latest` tag; prereleases use `next`.

## Bootstrap the package

npm requires the package to exist before a trusted publisher can be configured.
Publish `capacitor-oidc@0.0.1-alpha.0` from a trusted local machine:

```sh
npm login
npm ci
npm run verify
npm pack --dry-run
npm publish --access public --tag next
```

Use Node.js 24.19.0, which includes a trusted-publishing-compatible npm version.
Confirm the package name, contents, and a previously unpublished version before
the final command. npm may request account two-factor authentication.

On a package's first-ever publication, npm currently also creates `latest` even
when `--tag next` is supplied. The registry rejects deleting that only `latest`
tag with HTTP 400. This is registry bootstrap behavior, not approval for production
use; keep subsequent prereleases on `next` and do not intentionally move `latest`
until a stable release is approved. See [npm/cli#8490](https://github.com/npm/cli/issues/8490).

## Configure trusted publishing

After the first version exists, configure one GitHub Actions trusted publisher in
the npm package settings with these exact values:

| Setting              | Value            |
| -------------------- | ---------------- |
| Organization or user | `jojopirker`     |
| Repository           | `capacitor-oidc` |
| Workflow filename    | `publish.yml`    |
| Environment          | `npm-production` |
| Allowed action       | `npm publish`    |

The equivalent npm CLI command is:

```sh
npm trust github capacitor-oidc \
  --repo jojopirker/capacitor-oidc \
  --file publish.yml \
  --environment npm-production \
  --allow-publish
```

The package and workflow settings are case-sensitive. The workflow must exist in
`.github/workflows/` on the default branch before publishing a release.

Create the `npm-production` GitHub environment and add a required reviewer. Do not
add `NPM_TOKEN` or another publishing secret. Leave the repository variable
`NPM_PUBLISH_ENABLED` absent or set to `false` until the trusted publisher is
configured. Set it to `true` only while an approved release is being published.
Stable production releases additionally require the checks in
[Security](../SECURITY.md) and [Testing](TESTING.md) to be satisfied.

## Publish a release

1. Set an `X.Y.Z` or `X.Y.Z-prerelease` version in `package.json` and regenerate the lockfile.
2. Merge the version change into `main`.
3. Publish a GitHub release whose tag is exactly `vX.Y.Z` or `vX.Y.Z-prerelease`. Mark a prerelease version as a GitHub prerelease.
4. Approve the `npm-production` deployment after its checks are visible.

The workflow installs from the lockfile without a package-manager cache, verifies
the package, inspects the tarball, and publishes it publicly under `latest` for a
stable release or `next` for a prerelease. The job is skipped unless
`NPM_PUBLISH_ENABLED` is exactly `true`. npm automatically generates provenance for
a public package published from this public repository through a trusted publisher.

After the first trusted publication succeeds, configure npm to disallow traditional
token publishing and revoke unused automation tokens. Trusted publishing continues
to work because it uses OIDC rather than a registry token.

See the official npm documentation for
[trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[the `npm trust` command](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
