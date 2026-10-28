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
        device.findObject(By.desc("Message")).text = "See you at the next set"
        device.findObject(By.text("Send")).click()
        assertTrue(device.wait(Until.hasObject(By.text("See you at the next set")), 5000))
        device.pressBack()
        if (!device.wait(Until.hasObject(By.text("Chats")), 1500)) device.pressBack()
        assertTrue(device.wait(Until.hasObject(By.text("Chats")), 5000))
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
