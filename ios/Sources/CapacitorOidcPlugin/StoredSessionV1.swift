import Foundation

public struct StoredSessionV1: Codable, Equatable, Sendable {
    public let version: Int
    public let issuer: String
    public let clientId: String
    public let accessToken: String
    public let refreshToken: String?
    public let idToken: String?
    public let tokenType: String
    public let scope: String?
    public let expiresAt: Int?

    public init(
        version: Int = 1,
        issuer: String,
        clientId: String,
        accessToken: String,
        refreshToken: String? = nil,
        idToken: String? = nil,
        tokenType: String,
        scope: String? = nil,
        expiresAt: Int? = nil
    ) {
        self.version = version
        self.issuer = issuer
        self.clientId = clientId
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.idToken = idToken
        self.tokenType = tokenType
        self.scope = scope
        self.expiresAt = expiresAt
    }
}

