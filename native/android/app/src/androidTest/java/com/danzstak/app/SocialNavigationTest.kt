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
        if (!editorClosed) { val dump = java.io.ByteArrayOutputStream(); device.dumpWindowHierarchy(dump); println(dump.toString()) }
        assertTrue(editorClosed)
        assertTrue(device.hasObject(By.text("Corrected message")))
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
    @Test fun flashesUseFullScreenVerticalPaging() {
        device.findObject(By.desc("Open Flashes from DanzStak")).click()
        assertTrue(device.wait(Until.hasObject(By.text("1 / 3")), 5000))
        device.swipe(device.displayWidth / 2, device.displayHeight * 3 / 4, device.displayWidth / 2, device.displayHeight / 4, 18)
        assertTrue(device.wait(Until.hasObject(By.text("2 / 3")), 5000))
        device.findObject(By.text("Done")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Your Mix")), 5000))
    }
}
