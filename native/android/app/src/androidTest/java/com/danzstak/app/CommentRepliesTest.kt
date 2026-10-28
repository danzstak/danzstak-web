package com.danzstak.app

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.util.concurrent.atomic.AtomicInteger

@RunWith(AndroidJUnit4::class)
class CommentRepliesTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val device get() = UiDevice.getInstance(instrumentation)
    private fun launch(): MainActivity {
        val context = instrumentation.targetContext; val monitor = instrumentation.addMonitor(MainActivity::class.java.name, null, false)
        context.startActivity(context.packageManager.getLaunchIntentForPackage(context.packageName)!!.apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK); putExtra("preview", true); putExtra("comments_fixture", true) })
        val activity = instrumentation.waitForMonitorWithTimeout(monitor, 10000) as MainActivity; instrumentation.removeMonitor(monitor); instrumentation.waitForIdleSync(); device.waitForIdle()
        assertTrue(device.wait(Until.hasObject(By.desc("Comments, 3")), 10000)); return activity
    }
    @Test fun repliesAndNestedRepliesKeepTheirParentAndName() {
        val activity = launch(); device.findObject(By.desc("Comments, 3")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Reply to Commenter 1")), 5000))
        for (name in listOf("Commenter 1", "Commenter 2", "Commenter 3")) assertTrue(device.hasObject(By.desc("Reply to $name")))
        device.findObject(By.desc("Reply to Commenter 1")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Replying to Commenter 1")), 5000))
        device.findObject(By.desc("Comment text")).text = "A reply under the first comment"; device.findObject(By.desc("Send reply")).click()
        assertTrue(device.wait(Until.hasObject(By.text("A reply under the first comment")), 5000))
        assertTrue(device.hasObject(By.desc("Reply to You"))); device.findObject(By.desc("Reply to You")).click()
        assertTrue(device.wait(Until.hasObject(By.text("Replying to You")), 5000))
        device.findObject(By.desc("Comment text")).text = "A reply to the reply"; device.findObject(By.desc("Send reply")).click()
        assertTrue(device.wait(Until.hasObject(By.text("A reply to the reply")), 5000))
        var first = ""; var nested = ""
        instrumentation.runOnMainSync {
            val field = MainActivity::class.java.getDeclaredField("engagement").apply { isAccessible = true }
            @Suppress("UNCHECKED_CAST") val state = (field.get(activity) as Map<String, JSONObject>).getValue("demo-1")
            val rows = DanzStakApi.objects(state.getJSONArray("comments")); val reply = rows.first { it.optString("content") == "A reply under the first comment" }
            first = reply.optString("parentCommentId"); nested = rows.first { it.optString("content") == "A reply to the reply" }.optString("parentCommentId")
            assertEquals(reply.optString("commentId"), nested)
        }
        assertEquals("c1", first)
        device.findObject(By.desc("Close comments")).click()
        assertTrue(device.wait(Until.hasObject(By.desc("Comments, 5")), 5000))
    }
    @Test fun unsupportedBackendCannotSilentlyCreateAFlatReply() {
        val activity = launch(); val posts = AtomicInteger(0)
        val initial = JSONObject().put("reactionCounts", JSONObject()).put("myReaction", "").put("comments", JSONArray().put(JSONObject().put("commentId", "c1").put("authorName", "Jamie").put("content", "Original comment").put("createdAt", "2026-10-28T12:00:00Z")))
        val api = DanzStakApi(openConnection = { url -> object : HttpURLConnection(url) {
            private val output = ByteArrayOutputStream()
            override fun connect() {}; override fun disconnect() {}; override fun usingProxy() = false
            override fun setRequestMethod(value: String) { method = value }
            override fun getOutputStream() = output
            override fun getResponseCode(): Int { if (method == "POST") posts.incrementAndGet(); return 200 }
            override fun getInputStream() = ByteArrayInputStream(initial.toString().toByteArray())
        } }) { "opaque-test-session" }
        instrumentation.runOnMainSync { DiscussionDialog(activity, api, FeedPost("post", "Jamie", "Post", ""), initial, false, null,
            avatar = { _, _ -> android.widget.TextView(activity) }, linkedText = { text, _ -> android.widget.TextView(activity).apply { this.text = text } }, onChanged = {}, onVisible = {}, onDismiss = {}, onExpired = {}).show() }
        assertTrue(device.wait(Until.hasObject(By.desc("Reply to Jamie")), 5000)); device.findObject(By.desc("Reply to Jamie")).click()
        assertTrue(device.wait(Until.hasObject(By.textContains("Replies are waiting")), 5000))
        assertFalse(device.findObject(By.desc("Send reply")).isEnabled)
        device.findObject(By.desc("Comment text")).text = "Do not send this as a root comment"
        assertEquals(0, posts.get())
        device.findObject(By.desc("Cancel reply")).click(); assertTrue(device.findObject(By.desc("Send comment")).isEnabled)
        device.findObject(By.desc("Close comments")).click()
    }
}
