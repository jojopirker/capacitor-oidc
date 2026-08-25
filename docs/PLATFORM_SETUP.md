# iOS and Android setup

## iOS

The package supports iOS 15 and newer. Interactive login and logout use
`ASWebAuthenticationSession`, including the operating system's provider-consent
dialog and sheet presentation.

### Custom-scheme callback

For `com.example.app:/callback`, register `com.example.app` in the application
target's `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.example.app</string>
    </array>
  </dict>
</array>
```

Use an application-specific scheme that your organization controls. Register the
complete URI at the provider.

### HTTPS callback

HTTPS callbacks through `ASWebAuthenticationSession` require iOS 17.4 or newer.
Configure the appropriate Associated Domains entitlement and association file,
then register the exact HTTPS callback at the provider.

### Shared Keychain access

To let an iOS widget read the stored session, add the same Keychain Sharing
entitlement to the application and extension, then configure the expanded access
group:

```ts
const manager = await CapacitorUserManager.create(settings, {
  ios: {
    keychainAccessGroup: 'TEAMID.group.com.example.app',
    keychainAccessibility: 'afterFirstUnlockThisDeviceOnly',
  },
  storageNamespace: 'primary',
});
```

See [Sessions, secure storage, and widgets](SESSIONS_AND_WIDGETS.md) before
enabling shared access.

## Android

The Android adapter supports API 24 and newer. It is currently built and tested
with compile SDK 36, Android Gradle Plugin 8.9.1, Java 21, AndroidX Activity
1.11.0, and AndroidX Browser 1.10.0. Capacitor 7 applications may therefore need
their Android toolchain upgraded even though the JavaScript peer dependency
allows Capacitor 7.

### Custom-scheme callback

Keep the host application's existing `MainActivity` in Capacitor's default
`singleTask` launch mode. Add the callback intent filter inside that same activity
declaration:

```xml
<activity
  android:name=".MainActivity"
  android:launchMode="singleTask">
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="com.example.app" />
  </intent-filter>
</activity>
```

The `singleTask` activity receives callbacks from Auth Tab's Custom Tab fallback
through `onNewIntent`, allowing Capacitor to route the URL to the plugin instance
that opened the session.

### HTTPS callback

Configure a verified Android App Link and publish a matching Digital Asset Links
file. Register the exact HTTPS URI at the identity provider.

### Auth Tab behavior

AndroidX Auth Tab handles the result directly when the installed browser supports
it and falls back to a Custom Tab on older browsers. Calling `cancel()` rejects
the pending JavaScript promise, but Android does not expose an API that forcibly
closes an already-visible system Auth Tab or Custom Tab.

Ephemeral browsing is requested when configured and may be ignored by a fallback
browser.
