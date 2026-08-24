import XCTest
@testable import CapacitorOidcPlugin

final class StoredSessionV1Tests: XCTestCase {
    func testRoundTrip() throws {
        let session = StoredSessionV1(
            issuer: "https://issuer.example",
            clientId: "mobile",
            accessToken: "access",
            refreshToken: "refresh",
            tokenType: "Bearer",
            expiresAt: 1_800_000_000
        )

        let decoded = try JSONDecoder().decode(StoredSessionV1.self, from: JSONEncoder().encode(session))
        XCTAssertEqual(decoded, session)
    }
}
