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
        device.findObjects(By.descStartsWith("View profile of ")).first().click()
        assertTrue(device.wait(Until.hasObject(By.descStartsWith("Cover image of ")), 5000))
        assertTrue(device.hasObject(By.descStartsWith("Profile image of ")))
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
