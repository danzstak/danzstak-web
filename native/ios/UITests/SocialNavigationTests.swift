import XCTest

final class SocialNavigationTests: XCTestCase {
    func testStoriesAndReels() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        let composer = app.buttons["home.composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 20))
        XCTAssertLessThanOrEqual(composer.frame.height, 60)
        XCTAssertFalse(app.staticTexts["Good to see you."].exists)
        let story = app.buttons["story.demo-s1"]
        XCTAssertTrue(story.exists)
        XCTAssertGreaterThan(story.frame.minY, composer.frame.maxY)
        story.tap()
        XCTAssertTrue(app.staticTexts["Find your people. Feel your scene."].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        let reels = app.staticTexts["Reels"]
        for _ in 0..<8 {
            if reels.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(reels.isHittable)
        let fourth = app.staticTexts["A little practice, a fresh idea, and a track that won’t leave your head. What are you working on today?"]
        XCTAssertTrue(fourth.exists)
        XCTAssertLessThan(fourth.frame.maxY, reels.frame.minY)
    }

    func testFooterMenu() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Menu"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Menu"].tap()
        XCTAssertTrue(app.navigationBars["Menu"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.sliders["Header size"].exists)
        app.buttons["menu.profile"].tap()
        XCTAssertTrue(app.staticTexts["Your posts"].waitForExistence(timeout: 5))
    }

    func testCompactHeaderSearch() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--header-percent", "4"]
        app.launch()
        XCTAssertTrue(app.images["danzstak.brand"].waitForExistence(timeout: 20))
        app.buttons["Search feed"].tap()
        XCTAssertTrue(app.textFields["Search loaded posts and people"].waitForExistence(timeout: 5))
    }

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
        app.tabBars.buttons["Menu"].tap()
        app.buttons["Groups"].tap()
        XCTAssertTrue(app.staticTexts["DJs & Producers"].waitForExistence(timeout: 5))
    }

    func testDemoNavigationAndPosting() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["DEMO · Sample content"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["home.composer"].exists)
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
        app.tabBars.buttons["Menu"].tap()
        app.buttons["menu.profile"].tap()
        XCTAssertTrue(app.staticTexts["Your posts"].exists)
        app.buttons["Exit demo"].tap()
        XCTAssertTrue(app.buttons["Log in to DanzStak"].waitForExistence(timeout: 5))
    }

    func testComposerRetainsDraftWhenClosed() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.buttons["home.composer"].waitForExistence(timeout: 20))
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
