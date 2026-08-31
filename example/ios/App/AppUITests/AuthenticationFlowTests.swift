import XCTest

final class AuthenticationFlowTests: XCTestCase {
    func testLoginRefreshAndLogout() {
        continueAfterFailure = false
        let timeout: TimeInterval = 30
        let app = XCUIApplication()
        app.launch()

        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let continueButton = springboard.buttons.matching(
            NSPredicate(format: "label IN %@", ["Continue", "Fortfahren"])
        ).firstMatch
        let signedOut = app.staticTexts["Signed out"]
        func waitForSignOut() {
            let deadline = Date().addingTimeInterval(timeout)
            while !continueButton.exists && !signedOut.exists && Date() < deadline {
                RunLoop.current.run(until: Date().addingTimeInterval(0.2))
            }
            if continueButton.exists {
                continueButton.tap()
            }
            XCTAssertTrue(signedOut.waitForExistence(timeout: timeout))
            XCTAssertTrue(app.staticTexts["Provider and local session cleared"].exists)
        }

        let signIn = app.buttons["Sign in with Keycloak"]
        if !signIn.waitForExistence(timeout: timeout / 2) {
            app.terminate()
            app.launch()
        }
        XCTAssertTrue(signIn.waitForExistence(timeout: timeout), app.debugDescription)
        if !signIn.isEnabled {
            XCTAssertTrue(app.staticTexts["Hello, demo"].exists, app.debugDescription)
            app.buttons["Sign out"].tap()
            waitForSignOut()
            XCTAssertTrue(signIn.isEnabled, app.debugDescription)
        }

        let browser = XCUIApplication(bundleIdentifier: "com.apple.SafariViewService")
        let webView = browser.webViews.firstMatch
        func openLogin() -> XCUIElement {
            signIn.tap()
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
            return browser.textFields["Username or email"]
        }

        var username = openLogin()
        if !username.waitForExistence(timeout: timeout) {
            browser.terminate()
            app.activate()
            let authenticationFailed = app.staticTexts.matching(
                NSPredicate(format: "label BEGINSWITH %@", "Authentication failed:")
            ).firstMatch
            XCTAssertTrue(authenticationFailed.waitForExistence(timeout: timeout), app.debugDescription)
            username = openLogin()
        }
        XCTAssertTrue(username.waitForExistence(timeout: timeout), browser.debugDescription)
        let keyboard = browser.keyboards.firstMatch
        for _ in 0..<3 where !keyboard.exists {
            username.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
            _ = keyboard.waitForExistence(timeout: 2)
        }
        XCTAssertTrue(keyboard.exists, browser.debugDescription)
        for key in ["d", "e", "m", "o"] {
            browser.keys[key].tap()
        }

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
        for key in ["d", "e", "m", "o"] {
            browser.keys[key].tap()
        }
        browser.buttons["Sign In"].tap()

        let signedIn = app.staticTexts["Hello, demo"]
        let savePasswordAlert = app.alerts["Save Password?"]
        let loginDeadline = Date().addingTimeInterval(timeout)
        while !savePasswordAlert.exists && !signedIn.exists && Date() < loginDeadline {
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        if savePasswordAlert.exists {
            savePasswordAlert.buttons["Not Now"].tap()
        }
        XCTAssertTrue(signedIn.waitForExistence(timeout: max(0, loginDeadline.timeIntervalSinceNow)))

        app.buttons["Renew session"].coordinate(
            withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)
        ).tap()
        XCTAssertTrue(app.staticTexts["Session renewed through the refresh token"].waitForExistence(timeout: timeout))

        app.buttons["Sign out"].tap()
        waitForSignOut()
    }
}
