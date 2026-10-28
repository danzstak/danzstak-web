package com.danzstak.app

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiScrollable
import androidx.test.uiautomator.UiSelector
import androidx.test.uiautomator.Until
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

@RunWith(AndroidJUnit4::class)
class ProfileEditorTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val device get() = UiDevice.getInstance(instrumentation)
    private fun launch(): MainActivity {
        val context = instrumentation.targetContext
        val monitor = instrumentation.addMonitor(MainActivity::class.java.name, null, false)
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true) })
        val activity = instrumentation.waitForMonitorWithTimeout(monitor, 10000) as MainActivity
        instrumentation.removeMonitor(monitor); instrumentation.waitForIdleSync(); device.waitForIdle()
        assertTrue(device.wait(Until.hasObject(By.desc("Menu").pkg(context.packageName)), 10000))
        return activity
    }
    private fun openEditor() {
        device.findObject(By.desc("Menu").pkg("com.danzstak.app")).click()
        assertTrue(device.wait(Until.hasObject(By.text("My Profile")), 5000)); device.findObject(By.text("My Profile")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Edit Profile")), 5000)); device.findObject(By.text("Edit Profile")).click()
        ready()
    }
    private fun ready() {
        val success = device.wait(Until.hasObject(By.desc("Save profile changes").enabled(true)), 5000)
        if (!success) device.dumpWindowHierarchy(java.io.File(instrumentation.targetContext.cacheDir, "profile-editor-failure.xml"))
        assertTrue("Profile editor should load before saving", success)
    }
    private fun scroll() = UiScrollable(UiSelector().className(android.widget.ScrollView::class.java.name).scrollable(true))
    private fun field(name: String, value: String) { assertTrue(scroll().scrollIntoView(UiSelector().description(name))); device.findObject(By.desc(name)).text = value }

    @Test fun nativeEditorHasPwaFieldsAndSaveCancelPreserveProfile() {
        launch(); openEditor()
        assertTrue(device.hasObject(By.text("Change Profile Photo")))
        assertTrue(scroll().scrollIntoView(UiSelector().text("Reposition Cover")))
        device.findObject(By.text("Reposition Cover")).click()
        assertTrue(device.hasObject(By.desc("Horizontal cover position")))
        assertTrue(scroll().scrollIntoView(UiSelector().text("Fit entire cover")))
        device.findObject(By.text("Fit entire cover")).click()
        assertTrue(scroll().scrollIntoView(UiSelector().text("Add or change Profile Video")))
        field("Display name", "Native Artist"); field("Username", "native_artist"); field("Bio", "Original music and community"); field("Location", "Oakland"); field("Work", "Musician"); field("Website", "https://example.com")
        assertTrue(scroll().scrollIntoView(UiSelector().description("DanzStak language")))
        assertTrue(scroll().scrollIntoView(UiSelector().description("Who can post on your profile?"))); device.findObject(By.desc("Who can post on your profile?")).click(); device.findObject(By.text("Friends")).click()
        assertTrue(scroll().scrollIntoView(UiSelector().text("Allow people to tag me"))); device.findObject(By.text("Allow people to tag me")).click()
        device.findObject(By.text("Save Changes")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Native Artist")), 5000))
        openEditorFromProfile()
        assertTrue(scroll().scrollIntoView(UiSelector().description("Display name"))); assertEquals("Native Artist", device.findObject(By.desc("Display name")).text)
        assertTrue(scroll().scrollIntoView(UiSelector().description("Bio"))); assertEquals("Original music and community", device.findObject(By.desc("Bio")).text)
        field("Display name", "Discard this draft"); device.findObject(By.text("Cancel")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Native Artist")), 5000)); assertFalse(device.hasObject(By.text("Discard this draft")))
    }
    private fun openEditorFromProfile() { device.findObject(By.text("Edit Profile")).click(); ready() }

    @Test fun failedSaveKeepsTheDraftAndDisplaysTheNameSuggestion() {
        val activity = launch()
        val api = DanzStakApi(openConnection = { url -> object : HttpURLConnection(url) {
            private val bytes = ByteArrayOutputStream()
            override fun connect() {}; override fun disconnect() {}; override fun usingProxy() = false
            override fun getOutputStream() = bytes
            override fun setRequestMethod(value: String) { method = value }
            override fun getResponseCode() = if (url.path == "/profiles" && method == "POST") 409 else 200
            private fun response() = when { url.path == "/profiles" && method == "POST" -> """{"error":"That username is already taken. Try native_artist2 or another name."}"""; url.path == "/profiles" -> """{"profile":{"name":"Native Artist","handle":"native_artist"}}"""; else -> "{}" }
            override fun getInputStream() = ByteArrayInputStream(response().toByteArray())
            override fun getErrorStream() = ByteArrayInputStream(response().toByteArray())
        } }) { "opaque-test-session" }
        instrumentation.runOnMainSync { ProfileEditorDialog(activity, api, false, JSONObject(), { _, _ -> }, { _, _ -> }, { it }, {}, {}, {}, {}).show() }
        ready()
        field("Bio", "Keep my unsaved text")
        device.findObject(By.text("Save Changes")).click()
        assertTrue(scroll().scrollIntoView(UiSelector().textContains("native_artist2")))
        assertTrue(device.hasObject(By.text("Save Changes")))
        assertTrue(scroll().scrollIntoView(UiSelector().description("Bio"))); assertEquals("Keep my unsaved text", device.findObject(By.desc("Bio")).text)
        device.findObject(By.text("Cancel")).click()
    }
}
