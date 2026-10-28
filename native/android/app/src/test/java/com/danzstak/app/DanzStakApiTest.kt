package com.danzstak.app

import org.junit.Assert.*
import org.junit.Test
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

class DanzStakApiTest {
    private class Connection(url: URL, private val code: Int, private val response: String) : HttpURLConnection(url) {
        val body = ByteArrayOutputStream()
        var closed = false
        override fun setRequestMethod(value: String) { method = value }
        override fun connect() {}
        override fun disconnect() { closed = true }
        override fun usingProxy() = false
        override fun getResponseCode() = code
        override fun getInputStream() = ByteArrayInputStream(response.toByteArray())
        override fun getErrorStream() = ByteArrayInputStream(response.toByteArray())
        override fun getOutputStream() = body
    }
    @Test fun parsesTagsAndUsesOpaqueSessionWithNoRedirects() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, """{"posts":[{"postId":"p1","authorName":"Friend","content":"Hello","location":"Berlin","taggedUsers":[{"memberId":"m1","name":"You","isMe":true}]}]}""").also { connection = it } }) { "opaque-session" }
        val posts = api.posts()
        assertEquals("Berlin", posts.single().location)
        assertTrue(posts.single().tags.single().isMe)
        assertEquals("Bearer opaque-session", connection.getRequestProperty("Authorization"))
        assertEquals("https://www.danzstak.com", connection.getRequestProperty("Origin"))
        assertFalse(connection.instanceFollowRedirects)
        assertTrue(connection.closed)
    }
    @Test fun distinguishesExpiredSessionsFromTransportFailure() {
        val api = DanzStakApi(openConnection = { url -> Connection(url, 401, "{}") }) { "opaque" }
        assertThrows(SessionExpired::class.java) { api.posts() }
        val offline = DanzStakApi(openConnection = { throw java.io.IOException("Offline") }) { "opaque" }
        assertThrows(java.io.IOException::class.java) { offline.posts() }
    }
    @Test fun tagRemovalOnlySendsOwnTagFlag() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, "{}").also { connection = it } }) { "opaque" }
        api.removeOwnTag("33333333-3333-4333-a333-333333333333")
        assertEquals("PATCH", connection.requestMethod)
        val body = JSONObject(connection.body.toString("UTF-8"))
        assertTrue(body.getBoolean("removeOwnTag")); assertEquals(1, body.length())
    }
    @Test fun consentChangePreservesOtherPreferences() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, "{}").also { connection = it } }) { "opaque" }
        api.saveTagConsent(JSONObject().put("darkMode", true).put("onlineVisible", false).put("language", "de"), false)
        val body = JSONObject(connection.body.toString("UTF-8"))
        assertFalse(body.getBoolean("allowTags")); assertTrue(body.getBoolean("darkMode")); assertFalse(body.getBoolean("onlineVisible")); assertEquals("de", body.getString("language"))
    }
    @Test fun messageEditsAndDeletionUseOriginalIdentity() {
        lateinit var connection: Connection
        var response = """{"message":{"messageId":"m1","content":"Fixed","editedAt":"2026-10-28"}}"""
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, response).also { connection = it } }) { "opaque" }
        assertEquals("Fixed", api.editMessage("friend@example.com", "m1", "Fixed").getString("content"))
        var body = JSONObject(connection.body.toString("UTF-8"))
        assertEquals("edit", body.getString("action")); assertEquals("m1", body.getString("messageId"))
        response = "{}"; api.deleteMessage("friend@example.com", "m1", "me")
        body = JSONObject(connection.body.toString("UTF-8"))
        assertEquals("delete", body.getString("action")); assertEquals("me", body.getString("scope")); assertEquals("m1", body.getString("messageId"))
    }
    @Test fun profileUsesSelectedMemberAndRetainsBothImages() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, """{"profile":{"name":"Friend","picture":"https://example.com/avatar.jpg","cover":"https://example.com/cover.jpg"}}""").also { connection = it } }) { "opaque" }
        val profile = api.profile("friend+music@example.com")
        assertEquals("email=friend%2Bmusic%40example.com", connection.url.query)
        assertEquals("https://example.com/avatar.jpg", profile.getString("picture"))
        assertEquals("https://example.com/cover.jpg", profile.getString("cover"))
    }
    @Test fun chatContactQueryAndSendAreCorrect() {
        lateinit var connection: Connection
        var response = """{"messages":[],"canContact":true}"""
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, response).also { connection = it } }) { "opaque" }
        api.messages("friend+music@example.com")
        assertTrue(connection.url.query.contains("friend%2Bmusic%40example.com"))
        assertTrue(connection.url.query.contains("read=1"))
        response = """{"message":{"messageId":"m1","content":"Hey"}}"""
        assertEquals("Hey", api.sendMessage("friend@example.com", "Hey").getString("content"))
        assertEquals("friend@example.com", JSONObject(connection.body.toString("UTF-8")).getString("recipientEmail"))
    }
}
