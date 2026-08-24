import XCTest
@testable import CapacitorOidcPlugin

final class StoredSessionV1Tests: XCTestCase {
    func testDecodesSharedFixture() throws {
        let fixtureURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("contracts/fixtures/stored-session-v1.json")
        let session = try JSONDecoder().decode(StoredSessionV1.self, from: Data(contentsOf: fixtureURL))

        XCTAssertEqual(session.version, 1)
        XCTAssertEqual(session.issuer, "https://issuer.example")
        XCTAssertEqual(session.clientId, "mobile")
        XCTAssertEqual(session.accessToken, "access")
        XCTAssertEqual(session.refreshToken, "refresh")
        XCTAssertEqual(session.idToken, "id-token")
        XCTAssertEqual(session.tokenType, "Bearer")
        XCTAssertEqual(session.scope, "openid profile offline_access")
        XCTAssertEqual(session.expiresAt, 1_800_000_000)
    }

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
