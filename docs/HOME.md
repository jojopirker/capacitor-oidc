---
layout: home
title: OAuth 2.0 and OpenID Connect for Capacitor
description: One oidc-client-ts-compatible authentication manager for Capacitor web, iOS, and Android applications.

hero:
  name: capacitor-oidc
  text: OpenID Connect for Capacitor
  tagline: One oidc-client-ts-compatible manager for web, iOS, and Android, with native system authentication and secure mobile session storage.
  image:
    src: /logo@4x.png
    alt: A Doberman holding a key inside a phone
  actions:
    - theme: brand
      text: Get started
      link: /docs/GETTING_STARTED
    - theme: alt
      text: View on GitHub
      link: https://github.com/jojopirker/capacitor-oidc
    - theme: alt
      text: View on npm
      link: https://www.npmjs.com/package/capacitor-oidc

features:
  - title: One manager across platforms
    details: Use the same configuration and manager API in Capacitor web, iOS, and Android applications.
    link: /docs/GETTING_STARTED
    linkText: Get started
  - title: Native system authentication
    details: Sign in with ASWebAuthenticationSession on iOS and AndroidX Auth Tab with its Custom Tab fallback on Android.
    link: /docs/PLATFORM_SETUP
    linkText: Set up native platforms
  - title: Secure mobile storage
    details: Store sessions in iOS Keychain or encrypt them with an Android Keystore-backed AES-GCM key.
    link: /docs/SESSIONS_AND_WIDGETS
    linkText: Read about session storage
  - title: oidc-client-ts compatible
    details: Keep the familiar UserManager methods, session objects, and events while the plugin handles Capacitor-specific behavior.
    link: /docs/API
    linkText: Explore the API
  - title: Provider independent
    details: Connect to standards-compliant OAuth 2.0 and OpenID Connect providers without a provider-specific mobile SDK.
    link: /docs/PROVIDERS
    linkText: Configure a provider
  - title: Refresh on resume
    details: Renew native sessions with refresh tokens when the app starts, becomes active, or returns to the foreground.
    link: /docs/SESSIONS_AND_WIDGETS
    linkText: Understand renewal
---
