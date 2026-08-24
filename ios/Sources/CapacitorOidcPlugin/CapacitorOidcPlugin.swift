import AuthenticationServices
import Capacitor
import Foundation

@objc(CapacitorOidcPlugin)
public final class CapacitorOidcPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "CapacitorOidcPlugin"
    public let jsName = NativeContract.pluginName
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: NativeContract.Method.configure, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.open, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.cancel, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.storageSet, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.storageGet, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.storageRemove, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.storageGetAllKeys, returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: NativeContract.Method.setSessionSnapshot, returnType: CAPPluginReturnPromise)
    ]

    private var accessGroup: String?
    private var accessibility = TokenVaultAccessibility.afterFirstUnlockThisDeviceOnly
    private var authenticationSession: ASWebAuthenticationSession?
    private var authenticationCall: CAPPluginCall?

    @objc public func configure(_ call: CAPPluginCall) {
        accessGroup = call.getString(NativeContract.Field.keychainAccessGroup)
        if call.getString(NativeContract.Field.keychainAccessibility) == NativeContract.KeychainAccessibility.whenUnlockedThisDeviceOnly {
            accessibility = .whenUnlockedThisDeviceOnly
        } else {
            accessibility = .afterFirstUnlockThisDeviceOnly
        }
        call.resolve()
    }

    @objc public func open(_ call: CAPPluginCall) {
        guard authenticationSession == nil else {
            call.reject("An authentication session is already active", NativeContract.ErrorCode.authSessionInProgress)
            return
        }
        guard let urlValue = call.getString(NativeContract.Field.url), let url = URL(string: urlValue),
              let callbackValue = call.getString(NativeContract.Field.callbackUrl), let callbackURL = URL(string: callbackValue),
              let scheme = callbackURL.scheme else {
            call.reject("The authentication URL or callback URL is invalid", NativeContract.ErrorCode.invalidCallback)
            return
        }
        guard isSecureRequestURL(url) else {
            call.reject("The authentication URL must use HTTPS outside loopback development", NativeContract.ErrorCode.browserUnavailable)
            return
        }

        let completion: ASWebAuthenticationSession.CompletionHandler = { [weak self] callbackURL, error in
            DispatchQueue.main.async { self?.completeAuthentication(callbackURL: callbackURL, error: error) }
        }

        let session: ASWebAuthenticationSession
        if #available(iOS 17.4, *), scheme.lowercased() == "https" {
            guard let host = callbackURL.host else {
                call.reject("The HTTPS callback URL has no host", NativeContract.ErrorCode.invalidCallback)
                return
            }
            session = ASWebAuthenticationSession(
                url: url,
                callback: .https(host: host, path: callbackURL.path),
                completionHandler: completion
            )
        } else {
            guard scheme.lowercased() != "https" else {
                call.reject("HTTPS callbacks require iOS 17.4 or newer", NativeContract.ErrorCode.browserUnavailable)
                return
            }
            session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme, completionHandler: completion)
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = call.getBool(NativeContract.Field.prefersEphemeralWebBrowserSession) ?? false
        authenticationCall = call
        authenticationSession = session
        guard session.start() else {
            authenticationCall = nil
            authenticationSession = nil
            call.reject("The system authentication session could not start", NativeContract.ErrorCode.browserUnavailable)
            return
        }
    }

    @objc public func cancel(_ call: CAPPluginCall) {
        let activeCall = authenticationCall
        let activeSession = authenticationSession
        authenticationCall = nil
        authenticationSession = nil
        activeSession?.cancel()
        activeCall?.reject("The user cancelled authentication", NativeContract.ErrorCode.userCancelled)
        call.resolve()
    }

    @objc public func storageSet(_ call: CAPPluginCall) {
        guard let namespace = call.getString(NativeContract.Field.namespace), let key = call.getString(NativeContract.Field.key),
              let value = call.getString(NativeContract.Field.value) else {
            call.reject("Storage input is invalid", NativeContract.ErrorCode.secureStorageError)
            return
        }
        resolveStorage(call) { try vault().set(namespace: namespace, key: key, value: value); return [:] }
    }

    @objc public func storageGet(_ call: CAPPluginCall) {
        guard let namespace = call.getString(NativeContract.Field.namespace), let key = call.getString(NativeContract.Field.key) else {
            call.reject("Storage input is invalid", NativeContract.ErrorCode.secureStorageError)
            return
        }
        resolveStorage(call) { [NativeContract.Field.value: try vault().get(namespace: namespace, key: key) as Any] }
    }

    @objc public func storageRemove(_ call: CAPPluginCall) {
        guard let namespace = call.getString(NativeContract.Field.namespace), let key = call.getString(NativeContract.Field.key) else {
            call.reject("Storage input is invalid", NativeContract.ErrorCode.secureStorageError)
            return
        }
        resolveStorage(call) { [NativeContract.Field.value: try vault().remove(namespace: namespace, key: key) as Any] }
    }

    @objc public func storageGetAllKeys(_ call: CAPPluginCall) {
        guard let namespace = call.getString(NativeContract.Field.namespace) else {
            call.reject("Storage input is invalid", NativeContract.ErrorCode.secureStorageError)
            return
        }
        resolveStorage(call) { [NativeContract.Field.keys: try vault().getAllKeys(namespace: namespace)] }
    }

    @objc public func setSessionSnapshot(_ call: CAPPluginCall) {
        guard let namespace = call.getString(NativeContract.Field.namespace) else {
            call.reject("Storage input is invalid", NativeContract.ErrorCode.secureStorageError)
            return
        }
        resolveStorage(call) {
            try vault().setSessionSnapshot(namespace: namespace, value: call.getString(NativeContract.Field.value))
            return [:]
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    private func completeAuthentication(callbackURL: URL?, error: Error?) {
        let call = authenticationCall
        authenticationCall = nil
        authenticationSession = nil

        if let sessionError = error as? ASWebAuthenticationSessionError, sessionError.code == .canceledLogin {
            call?.reject("The user cancelled authentication", NativeContract.ErrorCode.userCancelled)
        } else if error != nil {
            call?.reject("The system authentication session failed", NativeContract.ErrorCode.browserUnavailable)
        } else if let callbackURL {
            call?.resolve([NativeContract.Field.url: callbackURL.absoluteString])
        } else {
            call?.reject("The authentication session returned no callback", NativeContract.ErrorCode.invalidCallback)
        }
    }

    private func vault() -> TokenVault {
        TokenVault(accessGroup: accessGroup, accessibility: accessibility)
    }

    private func isSecureRequestURL(_ url: URL) -> Bool {
        if url.scheme?.lowercased() == "https" { return true }
        guard url.scheme?.lowercased() == "http", let host = url.host?.lowercased() else { return false }
        return host == "localhost" || host == "127.0.0.1" || host == "::1"
    }

    private func resolveStorage(_ call: CAPPluginCall, operation: () throws -> [String: Any]) {
        do {
            call.resolve(try operation())
        } catch {
            call.reject("Secure storage failed", NativeContract.ErrorCode.secureStorageError)
        }
    }
}
