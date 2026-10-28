package com.danzstak.app

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SocialNavigationTest {
    private lateinit var device: UiDevice
    @Before fun launchPreview() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        device = UiDevice.getInstance(instrumentation)
        val context = instrumentation.targetContext
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true)
        })
        assertTrue(device.wait(Until.hasObject(By.text("Flashes").pkg("com.danzstak.app")), 20000))
    }
    @Test fun homeAndNativeChat() {
        assertTrue(device.hasObject(By.text("Flashes")))
        assertTrue(device.hasObject(By.text("Your Mix")))
        device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Chats")), 5000))
        device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message")), 5000))
        assertTrue(device.hasObject(By.desc("Dictate message")))
        device.findObject(By.desc("Message")).click()
        device.findObject(By.desc("Message")).text = "See you at https://example.com/show"
        device.findObject(By.desc("Send message")).click()
        assertTrue(device.wait(Until.hasObject(By.text("See you at https://example.com/show")), 5000))
        device.findObject(By.text("See you at https://example.com/show")).longClick()
        assertTrue(device.wait(Until.hasObject(By.text("Forward")), 5000))
        assertTrue(device.hasObject(By.text("Copy")))
        assertTrue(device.hasObject(By.text("Share")))
        device.findObject(By.text("Forward")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Jamie Rivera")), 5000))
        device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message")), 5000))
        assertEquals("See you at https://example.com/show", device.findObject(By.desc("Message")).text)
        device.pressBack()
        if (!device.wait(Until.hasObject(By.text("Chats")), 1500)) device.pressBack()
        assertTrue(device.wait(Until.hasObject(By.text("Chats")), 5000))
    }
    @Test fun ownMessagesCanBeEditedAndDeleted() {
        device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Chats")), 5000))
        device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message")), 5000))
        device.findObject(By.desc("Message")).text = "x".repeat(2001)
        assertEquals(2000, device.findObject(By.desc("Message")).text.length)
        device.findObject(By.desc("Message")).text = "Text before edit"
        device.findObject(By.desc("Send message")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Text before edit")), 5000))
        device.findObject(By.text("Text before edit")).longClick()
        assertTrue(device.wait(Until.hasObject(By.desc("Edit message")), 5000))
        assertTrue(device.hasObject(By.desc("React with 👍")))
        device.findObject(By.desc("Edit message")).text = "Corrected message"
        device.waitForIdle()
        device.findObject(By.res("android:id/button1")).click()
        val editorClosed = device.wait(Until.gone(By.desc("Edit message")), 5000)
        assertTrue(editorClosed)
        assertTrue(device.wait(Until.hasObject(By.text("Corrected message")), 5000))
        device.findObject(By.text("Corrected message")).longClick()
        device.findObject(By.desc("React with 👍")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message reactions")), 5000))
        val bubble = device.findObject(By.text("Corrected message")).visibleBounds
        val reaction = device.findObject(By.desc("Message reactions")).visibleBounds
        assertTrue(reaction.top >= bubble.bottom)
        assertTrue(reaction.centerX() > device.displayWidth / 2)
        device.findObject(By.text("Corrected message")).longClick()
        device.findObject(By.text("Delete for everyone")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Delete for everyone?")), 5000))
        device.findObject(By.res("android:id/button1")).click()
        assertTrue(device.wait(Until.gone(By.text("Corrected message")), 5000))
    }
    @Test fun receiverCanOnlyDeleteForThemselves() {
        device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Chats")), 5000))
        device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Ready for the next set?")), 5000))
        device.findObject(By.text("Ready for the next set?")).longClick()
        assertTrue(device.wait(Until.hasObject(By.text("Delete for me")), 5000))
        assertFalse(device.hasObject(By.text("Delete for everyone")))
        assertFalse(device.hasObject(By.desc("Edit message")))
        device.findObject(By.text("Delete for me")).click()
        assertTrue(device.wait(Until.gone(By.text("Ready for the next set?")), 5000))
    }
    @Test fun menuMatchesPwaAndHasNoHeaderSizeControl() {
        device.findObject(By.desc("Menu").pkg("com.danzstak.app")).click()
        assertTrue(device.wait(Until.hasObject(By.text("My Profile")), 5000))
        assertTrue(device.hasObject(By.text("Friends")))
        assertTrue(device.hasObject(By.text("Tribes")))
        assertTrue(device.hasObject(By.text("Photos")))
        assertTrue(device.hasObject(By.text("Videos")))
        assertFalse(device.hasObject(By.textContains("Header size")))
    }
    @Test fun privateAttachmentPlaybackAnd720pExport() {
        val instrumentation = InstrumentationRegistry.getInstrumentation(); val context = instrumentation.targetContext
        val input = java.io.File(context.cacheDir, "fixture-video.mp4")
        org.junit.Assume.assumeTrue("Read-only attachment fixture is not installed", input.isFile && java.io.File(context.cacheDir, "attachment-fixture.json").isFile)
        val monitor = instrumentation.addMonitor(MainActivity::class.java.name, null, false)
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("attachment_fixture", true) })
        val activity = instrumentation.waitForMonitorWithTimeout(monitor, 10000) as MainActivity
        instrumentation.removeMonitor(monitor)
        instrumentation.waitForIdleSync(); device.waitForIdle()
        assertTrue(device.wait(Until.hasObject(By.desc("Messages")), 10000)); device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Jamie Rivera")), 5000)); device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Attached photo loaded")), 60000))
        val scroll = androidx.test.uiautomator.UiScrollable(androidx.test.uiautomator.UiSelector().scrollable(true))
        assertTrue(scroll.scrollIntoView(androidx.test.uiautomator.UiSelector().description("Play attached video")))
        device.findObject(By.desc("Play attached video")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Chat video ready")), 60000)); assertEquals("com.danzstak.app", device.currentPackageName)
        assertTrue(device.hasObject(By.desc("Video progress"))); device.pressBack()
        val method = MainActivity::class.java.getDeclaredMethod("prepare720pVideo", java.io.File::class.java).apply { isAccessible = true }
        val output = method.invoke(activity, input) as java.io.File
        val extractor = android.media.MediaExtractor()
        try {
            extractor.setDataSource(output.path)
            val format = (0 until extractor.trackCount).map { extractor.getTrackFormat(it) }.first { it.getString(android.media.MediaFormat.KEY_MIME)?.startsWith("video/") == true }
            val width = format.getInteger(android.media.MediaFormat.KEY_WIDTH); val height = format.getInteger(android.media.MediaFormat.KEY_HEIGHT)
            assertEquals("video/avc", format.getString(android.media.MediaFormat.KEY_MIME)); assertTrue(width <= 1280 && height <= 720 || width <= 720 && height <= 1280)
        } finally { extractor.release(); output.delete() }
    }
    @Test fun profileVideosPageOnlyWithinTheSameProfile() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        org.junit.Assume.assumeTrue(java.io.File(context.cacheDir, "attachment-fixture.json").isFile)
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("profile_video_fixture", true) })
        assertTrue(device.wait(Until.hasObject(By.desc("Autoplay video by Profile A")), 10000))
        val sound = device.wait(Until.findObject(By.desc("Unmute feed video")), 5000)
        assertNotNull(sound); sound.click()
        assertTrue(device.wait(Until.hasObject(By.desc("Mute feed video")), 5000))
        assertFalse(device.hasObject(By.text("1 / 2")))
        device.findObject(By.desc("Mute feed video")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Unmute feed video")), 5000))
        device.findObject(By.desc("People").pkg("com.danzstak.app")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("View profile of Profile A")), 5000))
        device.findObject(By.desc("View profile of Profile A")).click()
        val scroll = androidx.test.uiautomator.UiScrollable(androidx.test.uiautomator.UiSelector().scrollable(true))
        assertTrue(scroll.scrollIntoView(androidx.test.uiautomator.UiSelector().description("Unmute feed video")))
        device.findObjects(By.desc("Unmute feed video")).first().click()
        assertTrue(device.wait(Until.hasObject(By.desc("Mute feed video")), 5000))
        device.findObject(By.desc("Mute feed video")).click()
        device.findObjects(By.desc("Autoplay video by Profile A")).first().click()
        assertTrue(device.wait(Until.hasObject(By.text("1 / 2")), 5000))
        device.swipe(device.displayWidth / 2, device.displayHeight * 3 / 4, device.displayWidth / 2, device.displayHeight / 4, 18)
        assertTrue(device.wait(Until.hasObject(By.text("2 / 2")), 5000)); assertFalse(device.hasObject(By.text("Other profile video")))
    }
    @Test fun onlyTwoCommentsAppearInline() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("comments_fixture", true) })
        assertTrue(device.wait(Until.hasObject(By.text("Preview comment 1")), 10000))
        val scroll = androidx.test.uiautomator.UiScrollable(androidx.test.uiautomator.UiSelector().scrollable(true))
        assertTrue(scroll.scrollIntoView(androidx.test.uiautomator.UiSelector().text("View all 3 comments")))
        assertTrue(device.hasObject(By.text("Preview comment 2"))); assertFalse(device.hasObject(By.text("Preview comment 3")))
        device.findObject(By.text("View all 3 comments")).click()
        assertTrue(device.wait(Until.hasObject(By.textContains("Preview comment 3")), 5000))
    }
    @Test fun feedSurvivesFumblingAndReopening() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.getSharedPreferences("danzstak_drafts", android.content.Context.MODE_PRIVATE).edit().remove("feed.position.preview").commit()
        fun reopen() { context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("remember_feed", true) }) }
        reopen(); assertTrue(device.wait(Until.hasObject(By.text("Your Mix")), 10000))
        val scroll = androidx.test.uiautomator.UiScrollable(androidx.test.uiautomator.UiSelector().scrollable(true))
        assertTrue(scroll.scrollIntoView(androidx.test.uiautomator.UiSelector().text("The Night Shift")))
        val viewport = device.findObject(By.scrollable(true)).visibleBounds
        val row = device.findObject(By.text("The Night Shift")).visibleBounds
        val delta = row.top - viewport.top - 35
        if (delta > 0) device.swipe(device.displayWidth / 2, viewport.bottom - 30, device.displayWidth / 2, viewport.bottom - 30 - delta, 20)
        try {
            repeat(3) { cycle -> device.setOrientationLeft(); device.waitForIdle(); assertTrue("Landscape cycle $cycle lost feed anchor", device.wait(Until.hasObject(By.text("The Night Shift")), 5000)); device.setOrientationNatural(); device.waitForIdle(); assertTrue("Portrait cycle $cycle lost feed anchor", device.wait(Until.hasObject(By.text("The Night Shift")), 5000)) }
            reopen(); assertTrue(device.wait(Until.hasObject(By.text("The Night Shift")), 10000))
        } finally { device.setOrientationNatural(); device.unfreezeRotation() }
    }
    @Test fun chatOptionsAndMultiMessageCopy() {
        device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Jamie Rivera")), 5000)); device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message")), 5000))
        for (text in listOf("First line to translate", "Second line to translate")) {
            device.findObject(By.desc("Message")).text = text; device.findObject(By.desc("Send message")).click()
            assertTrue(device.wait(Until.hasObject(By.text(text)), 5000))
        }
        device.findObject(By.desc("Chat options")).click()
        for (label in listOf("View contact", "Search", "Media", "Mute", "Disappearing messages", "Select messages", "Delete chat")) assertTrue(device.wait(Until.hasObject(By.text(label)), 5000))
        device.findObject(By.text("Select messages")).click()
        device.findObject(By.text("First line to translate")).click(); device.findObject(By.text("Second line to translate")).click()
        assertTrue(device.wait(Until.hasObject(By.text("2 selected")), 5000)); device.findObject(By.text("Copy selected")).click()
        var copied = ""
        InstrumentationRegistry.getInstrumentation().runOnMainSync { val context = InstrumentationRegistry.getInstrumentation().targetContext; copied = (context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager).primaryClip!!.getItemAt(0).coerceToText(context).toString() }
        assertEquals("First line to translate\n\nSecond line to translate", copied)
        device.findObject(By.text("Done")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Chat options")), 5000)); device.findObject(By.desc("Chat options")).click(); assertTrue(device.wait(Until.hasObject(By.text("Search")), 5000)); device.findObject(By.text("Search")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Search messages")), 5000)); device.findObject(By.desc("Search messages")).text = "First line"
        device.findObject(By.res("android:id/button1")).click()
        assertTrue(device.wait(Until.gone(By.text("Second line to translate")), 5000)); assertTrue(device.hasObject(By.text("First line to translate")))
    }
    @Test fun chatMediaButtonsAreInsideTheInputBox() {
        device.findObject(By.desc("Messages")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Jamie Rivera")), 5000))
        device.findObject(By.text("Jamie Rivera")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Message input box")), 5000))
        val box = device.findObject(By.desc("Message input box")).visibleBounds
        val attach = device.findObject(By.desc("Attach photo or video"))
        val camera = device.findObject(By.desc("Take photo or record video"))
        assertTrue(box.contains(attach.visibleBounds)); assertTrue(box.contains(camera.visibleBounds))
        camera.click()
        assertTrue(device.wait(Until.hasObject(By.text("Record video")), 5000))
        assertTrue(device.hasObject(By.text("Take photo")))
        device.pressBack()
    }
    @Test fun tribesShowPwaCategoriesAndAllowJoining() {
        device.findObject(By.desc("Menu").pkg("com.danzstak.app")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Tribes")), 5000))
        device.findObject(By.text("Tribes")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Create a Tribe")), 5000))
        assertTrue(device.hasObject(By.desc("Tribe name")))
        val scroll = androidx.test.uiautomator.UiScrollable(androidx.test.uiautomator.UiSelector().scrollable(true))
        assertTrue(scroll.scrollIntoView(androidx.test.uiautomator.UiSelector().description("Join Visual Artist")))
        device.findObject(By.desc("Join Visual Artist")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Leave Visual Artist")), 5000))
        device.findObject(By.desc("Leave Visual Artist")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Join Visual Artist")), 5000))
    }
    @Test fun emptyMediaKeepsBothPlaceholderRails() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("empty_media", true)
        })
        assertTrue(device.wait(Until.hasObject(By.desc("Flashes placeholder 1")), 10000))
        repeat(6) {
            if (!device.hasObject(By.desc("The Roll placeholder 1"))) device.swipe(device.displayWidth / 2, device.displayHeight * 4 / 5, device.displayWidth / 2, device.displayHeight / 4, 20)
        }
        assertTrue(device.wait(Until.hasObject(By.desc("The Roll placeholder 1")), 5000))
    }
    @Test fun videoLikesToggleWithoutOpeningResponders() {
        device.findObject(By.desc("Open Flashes from DanzStak")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("likes, 0")), 5000))
        device.findObject(By.desc("likes, 0")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("likes, 1")), 5000))
        assertTrue(device.hasObject(By.text("1 / 3")))
        device.findObject(By.desc("likes, 1")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("likes, 0")), 5000))
        device.findObject(By.desc("likes, 0")).longClick()
        assertTrue(device.wait(Until.hasObject(By.text("Likes")), 5000))
    }
    @Test fun peopleOpenProfileWithCoverAndAvatar() {
        device.findObject(By.desc("People").pkg("com.danzstak.app")).click()
        assertTrue(device.wait(Until.hasObject(By.descStartsWith("View profile of ")), 5000))
        assertFalse("Your own profile should not be listed among friends", device.hasObject(By.desc("View profile of You")))
        device.findObjects(By.descStartsWith("View profile of ")).first().click()
        assertTrue(device.wait(Until.hasObject(By.descStartsWith("Cover image of ")), 5000))
        assertTrue(device.hasObject(By.descStartsWith("Profile image of ")))
        val cover = device.findObject(By.descStartsWith("Cover image of ")).visibleBounds
        val viewport = device.findObject(By.clazz(android.widget.ScrollView::class.java)).visibleBounds
        assertTrue("Cover should meet the top of the profile viewport", kotlin.math.abs(cover.top - viewport.top) <= 2)
        assertTrue(device.hasObject(By.desc("Back")))
    }
    @Test fun flashesUseFullScreenVerticalPaging() {
        device.findObject(By.desc("Open Flashes from DanzStak")).click()
        assertTrue(device.wait(Until.hasObject(By.text("1 / 3")), 5000))
        device.swipe(device.displayWidth / 2, device.displayHeight * 3 / 4, device.displayWidth / 2, device.displayHeight / 4, 18)
        assertTrue(device.wait(Until.hasObject(By.text("2 / 3")), 5000))
        device.findObject(By.text("Done")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Your Mix")), 5000))
    }
}
