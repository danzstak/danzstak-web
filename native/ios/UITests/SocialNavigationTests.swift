import XCTest

final class SocialNavigationTests: XCTestCase {
    func testBrandSearchAndGroups() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.images["danzstak.brand"].waitForExistence(timeout: 20))
        app.buttons["Search feed"].tap()
        let search = app.textFields["Search loaded posts and people"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap()
        search.typeText("no-matching-member-or-post")
        XCTAssertTrue(app.staticTexts["No matching posts"].waitForExistence(timeout: 5))
        app.buttons["Search feed"].tap()
        XCTAssertTrue(app.staticTexts["DanzStak Community"].waitForExistence(timeout: 5))
        app.buttons["Groups"].tap()
        XCTAssertTrue(app.staticTexts["DJs & Producers"].waitForExistence(timeout: 5))
    }

    func testDemoNavigationAndPosting() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["DEMO · Sample content"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["Good to see you."].exists)
        app.tabBars.buttons["People"].tap()
        XCTAssertTrue(app.staticTexts["People in your feed"].exists)
        app.tabBars.buttons["Create"].tap()
        app.buttons["Create a post"].tap()
        let editor = app.textViews.firstMatch
        XCTAssertTrue(editor.waitForExistence(timeout: 5))
        editor.tap()
        editor.typeText("Simulator test post")
        app.switches.firstMatch.tap()
        app.navigationBars.buttons["Post"].tap()
        XCTAssertTrue(app.buttons["Create a post"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Home"].tap()
        XCTAssertTrue(app.staticTexts["Simulator test post"].waitForExistence(timeout: 5))
        app.buttons["Like"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Liked"].firstMatch.waitForExistence(timeout: 5))
        app.buttons["Comment"].firstMatch.tap()
        let field = app.textFields["Write a comment…"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText("A native comment")
        app.buttons["Send comment"].tap()
        XCTAssertTrue(app.staticTexts["A native comment"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        app.tabBars.buttons["Alerts"].tap()
        XCTAssertTrue(app.staticTexts["New comment on your post"].exists)
        app.tabBars.buttons["Profile"].tap()
        XCTAssertTrue(app.staticTexts["Your posts"].exists)
        app.buttons["Exit demo"].tap()
        XCTAssertTrue(app.buttons["Log in to DanzStak"].waitForExistence(timeout: 5))
    }

    func testComposerRetainsDraftWhenClosed() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["Good to see you."].waitForExistence(timeout: 20))
        app.tabBars.buttons["Create"].tap()
        app.buttons["Create a post"].tap()
        let editor = app.textViews.firstMatch
        editor.tap()
        editor.typeText("Keep my draft")
        app.buttons["Close"].tap()
        app.buttons["Create a post"].tap()
        XCTAssertEqual(app.textViews.firstMatch.value as? String, "Keep my draft")
    }
}
