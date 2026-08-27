import XCTest

final class AuthenticationFlowTests: XCTestCase {
    func testLoginRefreshAndLogout() {
        continueAfterFailure = false
        let timeout: TimeInterval = 30
        let app = XCUIApplication()
        app.launch()

        let signIn = app.buttons["Sign in with Keycloak"]
        XCTAssertTrue(signIn.waitForExistence(timeout: timeout), app.debugDescription)
        signIn.tap()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let continueButton = springboard.buttons.matching(
            NSPredicate(format: "label IN %@", ["Continue", "Fortfahren"])
        ).firstMatch
        let browser = XCUIApplication(bundleIdentifier: "com.apple.SafariViewService")
        let webView = browser.webViews.firstMatch
        let presentationDeadline = Date().addingTimeInterval(timeout)
        while !continueButton.exists && !webView.exists && Date() < presentationDeadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        if continueButton.exists {
            continueButton.tap()
        }

        XCTAssertTrue(
            webView.waitForExistence(timeout: timeout),
            "SpringBoard:\n\(springboard.debugDescription)\nBrowser:\n\(browser.debugDescription)"
        )
        let username = browser.textFields["Username or email"]
        XCTAssertTrue(username.waitForExistence(timeout: timeout))
        username.tap()
        username.typeText("demo")

        let password = browser.secureTextFields["Password"]
        XCTAssertTrue(password.waitForExistence(timeout: timeout))
        for _ in 0..<3 where !password.hasFocus {
            let advance = browser.buttons.matching(
                NSPredicate(format: "label IN %@", ["Continue", "Next", "Weiter"])
            ).allElementsBoundByIndex.first(where: \.isHittable)
            guard let advance else {
                XCTFail("No control advances to the password field")
                return
            }
            advance.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        }
        XCTAssertTrue(password.hasFocus)
        password.typeText("demo")
        browser.buttons["Sign In"].tap()

        XCTAssertTrue(app.staticTexts["Hello, demo"].waitForExistence(timeout: timeout))

        app.buttons["Renew session"].tap()
        XCTAssertTrue(app.staticTexts["Session renewed through the refresh token"].waitForExistence(timeout: timeout))

        app.buttons["Sign out"].tap()
        let signedOut = app.staticTexts["Signed out"]
        let signOutDeadline = Date().addingTimeInterval(timeout)
        while !continueButton.exists && !signedOut.exists && Date() < signOutDeadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        if continueButton.exists {
            continueButton.tap()
        }
        XCTAssertTrue(signedOut.waitForExistence(timeout: timeout))
        XCTAssertTrue(app.staticTexts["Provider and local session cleared"].exists)
    }
}
