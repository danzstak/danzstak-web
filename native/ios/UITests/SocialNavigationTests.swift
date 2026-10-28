import XCTest

final class SocialNavigationTests: XCTestCase {
    func testFeedAndProfileSoundControls() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-preview", "--video-controls-preview"]; app.launch()
        let sound = app.buttons["Unmute feed video"]
        XCTAssertTrue(sound.waitForExistence(timeout: 20))
        for _ in 0..<3 { if sound.isHittable { break }; app.swipeUp() }
        sound.tap(); XCTAssertTrue(app.buttons["Mute feed video"].exists); app.buttons["Mute feed video"].tap()
        app.tabBars.buttons["People"].tap()
        XCTAssertFalse(app.staticTexts["You"].exists)
        app.staticTexts["DanzStak Community"].firstMatch.tap()
        let cover = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Cover image of DanzStak Community")).firstMatch
        XCTAssertTrue(cover.waitForExistence(timeout: 5)); XCTAssertLessThan(cover.frame.minY, 200)
        let identity = XCTAttachment(screenshot: app.screenshot()); identity.name = "Native-iOS-profile-cover"; identity.lifetime = .keepAlways; add(identity)
        for _ in 0..<5 { if sound.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(sound.isHittable); sound.tap(); XCTAssertTrue(app.buttons["Mute feed video"].exists)
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = "Native-iOS-profile-video-controls"; attachment.lifetime = .keepAlways; add(attachment)
    }

    func testNativeMenuSectionsAndChatLink() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-preview"]; app.launch()
        XCTAssertTrue(app.tabBars.buttons["Menu"].waitForExistence(timeout: 20)); app.tabBars.buttons["Menu"].tap()
        app.buttons["Events"].tap(); XCTAssertTrue(app.navigationBars["Events"].waitForExistence(timeout: 5)); XCTAssertTrue(app.staticTexts["No published events in your loaded feed."].exists)
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Saved"].tap(); XCTAssertTrue(app.navigationBars["Saved"].waitForExistence(timeout: 5))
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Booking Agent"].tap(); XCTAssertTrue(app.textFields["booking.artist"].waitForExistence(timeout: 5)); XCTAssertTrue(app.textFields["booking.home"].exists)
        app.tabBars.buttons["Home"].tap()
        app.buttons["header.messages"].tap(); XCTAssertTrue(app.buttons["chat.preview-jamie"].waitForExistence(timeout: 5)); app.buttons["chat.preview-jamie"].tap()
        let composer = app.textFields["chat.composer"]; composer.tap(); composer.typeText("www.danzstak.com/feed.html#events"); app.buttons["Send message"].tap()
        let link = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "www.danzstak.com/feed.html#events")).firstMatch; XCTAssertTrue(link.waitForExistence(timeout: 5)); link.tap()
        XCTAssertTrue(app.navigationBars["Events"].waitForExistence(timeout: 8))
    }
    func testNativeChatPreview() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.buttons["header.messages"].waitForExistence(timeout: 20))
        app.buttons["header.messages"].tap()
        XCTAssertTrue(app.navigationBars["Chats"].waitForExistence(timeout: 5))
        app.buttons["chat.preview-jamie"].tap()
        let composer = app.textFields["chat.composer"]
        XCTAssertTrue(composer.waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Dictate message"].exists)
        XCTAssertTrue(app.buttons["Attach photo or video"].exists)
        XCTAssertTrue(app.buttons["Take photo or record video"].exists)
        composer.tap(); composer.typeText("See you at https://example.com/show")
        app.buttons["Send message"].tap()
        XCTAssertTrue(app.staticTexts["See you at https://example.com/show"].waitForExistence(timeout: 5))
        XCTAssertEqual(composer.value as? String, "Message")
        app.staticTexts["See you at https://example.com/show"].firstMatch.press(forDuration: 0.7)
        XCTAssertTrue(app.textViews["chat.edit"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["React with 👍"].exists)
        app.buttons["Cancel"].tap()
    }

    func testChatOptionsAndMultiMessageCopy() {
        let app = XCUIApplication(); app.launchArguments = ["--ui-preview"]; app.launch()
        XCTAssertTrue(app.buttons["header.messages"].waitForExistence(timeout: 20)); app.buttons["header.messages"].tap()
        XCTAssertTrue(app.buttons["chat.preview-jamie"].waitForExistence(timeout: 5)); app.buttons["chat.preview-jamie"].tap()
        let composer = app.textFields["chat.composer"]
        for text in ["First line to translate", "Second line to translate"] { composer.tap(); composer.typeText(text); app.buttons["Send message"].tap(); XCTAssertTrue(app.staticTexts[text].waitForExistence(timeout: 5)) }
        app.buttons["Chat options"].tap()
        for title in ["View contact", "Search", "Media", "Mute", "Disappearing messages", "Select messages", "Delete chat"] { XCTAssertTrue(app.buttons[title].exists) }
        app.buttons["Select messages"].tap(); app.staticTexts["First line to translate"].tap(); app.staticTexts["Second line to translate"].tap()
        XCTAssertTrue(app.staticTexts["2 selected"].waitForExistence(timeout: 5)); app.buttons["Copy selected"].tap(); XCTAssertTrue(app.staticTexts["Messages copied"].exists)
    }

    func testRemoveOwnPhotoTag() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--tagging-preview"]
        app.launch()
        let media = app.descendants(matching: .any)["post.media.demo-1"].firstMatch
        XCTAssertTrue(media.waitForExistence(timeout: 20))
        for _ in 0..<3 { if media.isHittable { break }; app.swipeUp() }
        media.press(forDuration: 0.8)
        let remove = app.buttons["Remove my tag"]
        XCTAssertTrue(remove.waitForExistence(timeout: 5))
        remove.tap()
        XCTAssertFalse(app.staticTexts["Tagged preview user"].exists)
    }

    func testTaggingControls() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.buttons["home.composer"].waitForExistence(timeout: 20))
        app.buttons["home.composer"].tap()
        app.buttons["Tag people · Add location"].tap()
        XCTAssertTrue(app.textFields["tags.location"].waitForExistence(timeout: 5))
        app.textFields["tags.location"].tap()
        app.textFields["tags.location"].typeText("Los Angeles")
        app.buttons["Jamie Rivera"].tap()
        app.buttons["Done"].tap()
        XCTAssertTrue(app.staticTexts["Jamie Rivera"].exists)
        XCTAssertTrue(app.staticTexts["Los Angeles"].exists)
        app.buttons["Close"].tap()
        app.tabBars.buttons["Menu"].tap()
        app.buttons["menu.profile"].tap()
        app.buttons["Edit Profile"].tap()
        let toggle = app.switches["profile.allowTags"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5))
        toggle.switches.firstMatch.exists ? toggle.switches.firstMatch.tap() : toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.5)).tap()
        XCTAssertTrue(NSPredicate(format: "value == %@", "0").evaluate(with: toggle) || XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "0"), object: toggle)], timeout: 5) == .completed)
    }

    func testLongPressPostResponders() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.buttons["home.composer"].waitForExistence(timeout: 20))
        let like = app.buttons["Like"].firstMatch
        for _ in 0..<3 { if like.isHittable { break }; app.swipeUp() }
        like.tap()
        let liked = app.buttons["Liked"].firstMatch
        XCTAssertTrue(liked.waitForExistence(timeout: 5))
        liked.press(forDuration: 0.7)
        XCTAssertTrue(app.navigationBars["Likes"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["You"].exists)
        app.navigationBars.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Liked"].firstMatch.waitForExistence(timeout: 5))
    }

    func testLongResponderName() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--response-style", "full", "--long-name-preview"]
        app.launch()
        let story = app.buttons["story.demo-s1"]
        XCTAssertTrue(story.waitForExistence(timeout: 20))
        story.tap()
        let caption = app.staticTexts["viewer.caption.demo-s1"]
        XCTAssertTrue(caption.waitForExistence(timeout: 5))
        caption.press(forDuration: 0.7)
        app.buttons["React 👍"].tap()
        app.buttons["media.likes"].tap()
        let name = app.staticTexts["response.name"].firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        XCTAssertEqual(name.label, "Alexandra Christine Montgomery-Williams")
        XCTAssertGreaterThan(name.frame.height, 25)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Full-screen-long-name"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testMediaCommentCounts() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--response-style", "drawer"]
        app.launch()
        let story = app.buttons["story.demo-s1"]
        XCTAssertTrue(story.waitForExistence(timeout: 20))
        story.tap()
        let field = app.textFields["Write a comment…"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        for text in ["First comment", "Second comment"] {
            field.tap(); field.typeText(text)
            app.buttons["Send media comment"].tap()
        }
        XCTAssertTrue(app.buttons["media.comments"].label.contains("2"))
        app.buttons["media.comments"].tap()
        XCTAssertTrue(app.staticTexts["Comments"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["First comment"].exists)
        XCTAssertTrue(app.staticTexts["Second comment"].exists)
    }

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
        XCTAssertFalse(app.tabBars.firstMatch.isHittable)
        XCTAssertGreaterThanOrEqual(app.otherElements["media.page.demo-s1"].frame.height, app.frame.height * 0.8)
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["One more track. One more moment."].waitForExistence(timeout: 5))
        waitUntilVisible(app.staticTexts["One more track. One more moment."])
        app.buttons["Done"].tap()
        let reels = app.staticTexts["The Roll"]
        for _ in 0..<8 {
            if reels.isHittable { break }
            app.swipeUp()
        }
        XCTAssertTrue(reels.isHittable)
        let fourth = app.staticTexts["A little practice, a fresh idea, and a track that won’t leave your head. What are you working on today?"]
        XCTAssertTrue(fourth.exists)
        XCTAssertLessThan(fourth.frame.maxY, reels.frame.minY)
        app.buttons["reel.demo-r1"].tap()
        XCTAssertTrue(app.staticTexts["In the mix"].waitForExistence(timeout: 5))
        waitUntilVisible(app.staticTexts["viewer.caption.demo-r1"])
        app.swipeUp()
        XCTAssertTrue(app.staticTexts["Behind the sound"].waitForExistence(timeout: 5))
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Reels after swipe"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        waitUntilVisible(app.staticTexts["viewer.caption.demo-r2"])
        app.buttons["Done"].tap()
    }

    func testFullScreenResponseList() { checkResponseList(style: "full") }
    func testSlideOutResponseList() { checkResponseList(style: "drawer") }

    private func checkResponseList(style: String) {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--response-style", style]
        app.launch()
        let story = app.buttons["story.demo-s1"]
        XCTAssertTrue(story.waitForExistence(timeout: 20))
        story.tap()
        let caption = app.staticTexts["Find your people. Feel your scene."]
        XCTAssertTrue(caption.waitForExistence(timeout: 5))
        caption.press(forDuration: 0.7)
        XCTAssertTrue(app.buttons["React 👍"].waitForExistence(timeout: 5))
        app.buttons["React 👍"].tap()
        XCTAssertTrue(app.buttons["media.likes"].label.contains("1"))
        app.buttons["media.likes"].tap()
        if style == "drawer" {
            XCTAssertTrue(app.staticTexts["Likes"].waitForExistence(timeout: 5))
            XCTAssertLessThan(app.otherElements["media.responseDrawer"].frame.width, app.frame.width / 3)
        } else { XCTAssertTrue(app.navigationBars["Likes"].waitForExistence(timeout: 5)) }
        XCTAssertTrue(app.staticTexts["You"].exists)
        if style == "drawer" { XCTAssertTrue(app.tabBars.firstMatch.exists) }
        else { XCTAssertFalse(app.tabBars.firstMatch.isHittable) }
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Responses-\(style)"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testFooterMenu() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Menu"].waitForExistence(timeout: 20))
        app.tabBars.buttons["Menu"].tap()
        XCTAssertTrue(app.navigationBars["Menu"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.sliders["Header size"].exists)
        XCTAssertTrue(app.buttons["Friends"].exists)
        XCTAssertTrue(app.buttons["Photos"].exists)
        XCTAssertTrue(app.buttons["Videos"].exists)
        app.buttons["menu.profile"].tap()
        XCTAssertTrue(app.staticTexts["Your posts"].waitForExistence(timeout: 5))
    }

    func testCompactHeaderSearch() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview", "--header-percent", "4"]
        app.launch()
        XCTAssertTrue(app.images["danzstak.brand"].waitForExistence(timeout: 20))
        let messages = app.buttons["header.messages"]
        XCTAssertTrue(messages.exists)
        XCTAssertGreaterThan(messages.frame.minX, app.buttons["Search Your Mix"].frame.minX)
        XCTAssertLessThan(app.buttons["header.facebookImport"].frame.maxX, app.buttons["Search Your Mix"].frame.maxX)
        app.buttons["Search Your Mix"].tap()
        XCTAssertTrue(app.textFields["Search loaded posts and people"].waitForExistence(timeout: 5))
    }

    private func waitUntilVisible(_ element: XCUIElement) {
        let condition = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in element.isHittable }, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [condition], timeout: 5), .completed)
    }

    func testImportInstructions() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        let button = app.buttons["header.facebookImport"]
        XCTAssertTrue(button.waitForExistence(timeout: 20))
        button.tap()
        XCTAssertTrue(app.navigationBars["Import Facebook data"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["1. Download your information"].exists)
        XCTAssertTrue(app.staticTexts["2. Choose JSON format"].exists)
    }

    func testBrandSearchAndGroups() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.images["danzstak.brand"].waitForExistence(timeout: 20))
        app.buttons["Search Your Mix"].tap()
        let search = app.textFields["Search loaded posts and people"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        search.tap()
        search.typeText("no-matching-member-or-post")
        XCTAssertTrue(app.staticTexts["No matching posts"].waitForExistence(timeout: 5))
        app.buttons["Search Your Mix"].tap()
        XCTAssertTrue(app.staticTexts["DanzStak Community"].waitForExistence(timeout: 5))
        app.tabBars.buttons["Menu"].tap()
        app.buttons["Tribes"].tap()
        XCTAssertTrue(app.staticTexts["Create a Tribe"].waitForExistence(timeout: 5))
        let membership = app.buttons["tribes.join.default-0"]
        for _ in 0..<4 { if membership.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(membership.waitForExistence(timeout: 5))
        membership.tap()
        XCTAssertEqual(membership.label, "Joined")
        membership.tap()
        XCTAssertEqual(membership.label, "Join Tribe")
    }

    func testDemoNavigationAndPosting() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-preview"]
        app.launch()
        XCTAssertTrue(app.staticTexts["DEMO · Sample content"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["home.composer"].exists)
        app.tabBars.buttons["People"].tap()
        XCTAssertTrue(app.staticTexts["People in Your Mix"].exists)
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
