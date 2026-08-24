import Foundation
import Security

public enum TokenVaultAccessibility: Sendable {
    case afterFirstUnlockThisDeviceOnly
    case whenUnlockedThisDeviceOnly

    var keychainValue: CFString {
        switch self {
        case .afterFirstUnlockThisDeviceOnly:
            return kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        case .whenUnlockedThisDeviceOnly:
            return kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }
    }
}

public enum TokenVaultError: Error {
    case keychain(OSStatus)
    case invalidSession
}

public final class TokenVault: @unchecked Sendable {
    public static let sessionSnapshotKey = "widget-session-v1"

    private let service: String
    private let accessGroup: String?
    private let accessibility: TokenVaultAccessibility

    public init(
        service: String = "com.jojopirker.capacitor.oidc",
        accessGroup: String? = nil,
        accessibility: TokenVaultAccessibility = .afterFirstUnlockThisDeviceOnly
    ) {
        self.service = service
        self.accessGroup = accessGroup
        self.accessibility = accessibility
    }

    public func set(namespace: String, key: String, value: String) throws {
        let data = Data(value.utf8)
        let query = itemQuery(namespace: namespace, key: key)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData: data] as CFDictionary)
        if status == errSecSuccess { return }
        if status != errSecItemNotFound { throw TokenVaultError.keychain(status) }

        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = accessibility.keychainValue
        let addStatus = SecItemAdd(item as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw TokenVaultError.keychain(addStatus) }
    }

    public func get(namespace: String, key: String) throws -> String? {
        var query = itemQuery(namespace: namespace, key: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw TokenVaultError.keychain(status)
        }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    public func remove(namespace: String, key: String) throws -> String? {
        let value = try get(namespace: namespace, key: key)
        let status = SecItemDelete(itemQuery(namespace: namespace, key: key) as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw TokenVaultError.keychain(status)
        }
        return value
    }

    public func getAllKeys(namespace: String) throws -> [String] {
        var query = baseQuery()
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitAll

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return [] }
        guard status == errSecSuccess, let items = result as? [[String: Any]] else {
            throw TokenVaultError.keychain(status)
        }

        let prefix = "\(namespace)."
        return items.compactMap { item in
            guard let account = item[kSecAttrAccount as String] as? String, account.hasPrefix(prefix) else { return nil }
            return String(account.dropFirst(prefix.count))
        }
    }

    public func setSessionSnapshot(namespace: String, value: String?) throws {
        if let value {
            try set(namespace: namespace, key: Self.sessionSnapshotKey, value: value)
        } else {
            try remove(namespace: namespace, key: Self.sessionSnapshotKey)
        }
    }

    public func loadSession(namespace: String) throws -> StoredSessionV1? {
        guard let value = try get(namespace: namespace, key: Self.sessionSnapshotKey),
              let data = value.data(using: .utf8) else { return nil }
        let session = try JSONDecoder().decode(StoredSessionV1.self, from: data)
        guard session.version == 1 else { throw TokenVaultError.invalidSession }
        return session
    }

    private func baseQuery() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrSynchronizable as String: false
        ]
        if let accessGroup { query[kSecAttrAccessGroup as String] = accessGroup }
        return query
    }

    private func itemQuery(namespace: String, key: String) -> [String: Any] {
        var query = baseQuery()
        query[kSecAttrAccount as String] = "\(namespace).\(key)"
        return query
    }
}

