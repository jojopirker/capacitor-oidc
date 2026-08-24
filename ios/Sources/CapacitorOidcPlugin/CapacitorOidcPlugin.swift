import AuthenticationServices
import Capacitor
import Foundation

@objc(CapacitorOidcPlugin)
public final class CapacitorOidcPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "CapacitorOidcPlugin"
    public let jsName = "CapacitorOidc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storageSet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storageGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storageRemove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "storageGetAllKeys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSessionSnapshot", returnType: CAPPluginReturnPromise)
    ]

    private var accessGroup: String?
    private var accessibility = TokenVaultAccessibility.afterFirstUnlockThisDeviceOnly
    private var authenticationSession: ASWebAuthenticationSession?
    private var authenticationCall: CAPPluginCall?

    @objc public func configure(_ call: CAPPluginCall) {
        accessGroup = call.getString("keychainAccessGroup")
        if call.getString("keychainAccessibility") == "whenUnlockedThisDeviceOnly" {
            accessibility = .whenUnlockedThisDeviceOnly
        } else {
            accessibility = .afterFirstUnlockThisDeviceOnly
        }
        call.resolve()
    }

    @objc public func open(_ call: CAPPluginCall) {
        guard authenticationSession == nil else {
            call.reject("An authentication session is already active", "AUTH_SESSION_IN_PROGRESS")
            return
        }
        guard let urlValue = call.getString("url"), let url = URL(string: urlValue),
              let callbackValue = call.getString("callbackUrl"), let callbackURL = URL(string: callbackValue),
              let scheme = callbackURL.scheme else {
            call.reject("The authentication URL or callback URL is invalid", "INVALID_CALLBACK")
            return
        }
        guard isSecureRequestURL(url) else {
            call.reject("The authentication URL must use HTTPS outside loopback development", "BROWSER_UNAVAILABLE")
            return
        }

        let completion: ASWebAuthenticationSession.CompletionHandler = { [weak self] callbackURL, error in
            DispatchQueue.main.async { self?.completeAuthentication(callbackURL: callbackURL, error: error) }
        }

        let session: ASWebAuthenticationSession
        if #available(iOS 17.4, *), scheme.lowercased() == "https" {
            guard let host = callbackURL.host else {
                call.reject("The HTTPS callback URL has no host", "INVALID_CALLBACK")
                return
            }
            session = ASWebAuthenticationSession(
                url: url,
                callback: .https(host: host, path: callbackURL.path),
                completionHandler: completion
            )
        } else {
            guard scheme.lowercased() != "https" else {
                call.reject("HTTPS callbacks require iOS 17.4 or newer", "BROWSER_UNAVAILABLE")
                return
            }
            session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme, completionHandler: completion)
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = call.getBool("prefersEphemeralWebBrowserSession") ?? false
        authenticationCall = call
        authenticationSession = session
        guard session.start() else {
            authenticationCall = nil
            authenticationSession = nil
            call.reject("The system authentication session could not start", "BROWSER_UNAVAILABLE")
            return
        }
    }

    @objc public func cancel(_ call: CAPPluginCall) {
        let activeCall = authenticationCall
        let activeSession = authenticationSession
        authenticationCall = nil
        authenticationSession = nil
        activeSession?.cancel()
        activeCall?.reject("The user cancelled authentication", "USER_CANCELLED")
        call.resolve()
    }

    @objc public func storageSet(_ call: CAPPluginCall) {
        guard let namespace = call.getString("namespace"), let key = call.getString("key"),
              let value = call.getString("value") else {
            call.reject("Storage input is invalid", "SECURE_STORAGE_ERROR")
            return
        }
        resolveStorage(call) { try vault().set(namespace: namespace, key: key, value: value); return [:] }
    }

    @objc public func storageGet(_ call: CAPPluginCall) {
        guard let namespace = call.getString("namespace"), let key = call.getString("key") else {
            call.reject("Storage input is invalid", "SECURE_STORAGE_ERROR")
            return
        }
        resolveStorage(call) { ["value": try vault().get(namespace: namespace, key: key) as Any] }
    }

    @objc public func storageRemove(_ call: CAPPluginCall) {
        guard let namespace = call.getString("namespace"), let key = call.getString("key") else {
            call.reject("Storage input is invalid", "SECURE_STORAGE_ERROR")
            return
        }
        resolveStorage(call) { ["value": try vault().remove(namespace: namespace, key: key) as Any] }
    }

    @objc public func storageGetAllKeys(_ call: CAPPluginCall) {
        guard let namespace = call.getString("namespace") else {
            call.reject("Storage input is invalid", "SECURE_STORAGE_ERROR")
            return
        }
        resolveStorage(call) { ["keys": try vault().getAllKeys(namespace: namespace)] }
    }

    @objc public func setSessionSnapshot(_ call: CAPPluginCall) {
        guard let namespace = call.getString("namespace") else {
            call.reject("Storage input is invalid", "SECURE_STORAGE_ERROR")
            return
        }
        resolveStorage(call) {
            try vault().setSessionSnapshot(namespace: namespace, value: call.getString("value"))
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
            call?.reject("The user cancelled authentication", "USER_CANCELLED")
        } else if error != nil {
            call?.reject("The system authentication session failed", "BROWSER_UNAVAILABLE")
        } else if let callbackURL {
            call?.resolve(["url": callbackURL.absoluteString])
        } else {
            call?.reject("The authentication session returned no callback", "INVALID_CALLBACK")
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
            call.reject("Secure storage failed", "SECURE_STORAGE_ERROR")
        }
    }
}
