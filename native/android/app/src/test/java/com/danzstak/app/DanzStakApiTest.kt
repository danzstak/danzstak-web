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
    @Test fun tribesUseSharedCloudMembershipAndCreationContracts() {
        lateinit var connection: Connection
        var response = """{"groupIds":["default-0","default-6"]}"""
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, response).also { connection = it } }) { "opaque" }
        assertEquals(setOf("default-0", "default-6"), api.groupMemberships())
        assertEquals("list", JSONObject(connection.body.toString("UTF-8")).getString("action"))
        response = "{}"; api.joinGroup("default-6", true)
        var body = JSONObject(connection.body.toString("UTF-8")); assertEquals("default-6", body.getString("groupId")); assertTrue(body.getBoolean("joined"))
        response = """{"group":{"id":"33333333-3333-4333-a333-333333333333","name":"Our scene"}}"""
        assertEquals("Our scene", api.createGroup("Our scene", "Creators").getString("name"))
        body = JSONObject(connection.body.toString("UTF-8")); assertTrue(body.getBoolean("communityStandards")); assertEquals("Creators", body.getString("category"))
        response = "{}"; api.reportGroup("default-6", "Review this")
        body = JSONObject(connection.body.toString("UTF-8")); assertEquals("group", body.getString("targetType")); assertEquals("default-6", body.getString("groupId"))
    }
    @Test fun chatSettingsAndDeletionPreserveContactAndExplicitMediaChoice() {
        lateinit var connection: Connection
        var response = """{"settings":{"muted":true,"disappearingSeconds":86400}}"""
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, response).also { connection = it } }) { "opaque" }
        assertTrue(api.chatSettings("friend@example.com", muted = true, seconds = 86400).getBoolean("muted"))
        val settings = JSONObject(connection.body.toString("UTF-8")); assertEquals("settings", settings.getString("action")); assertEquals("friend@example.com", settings.getString("contactEmail"))
        response = "{}"; api.deleteChat("friend+music@example.com")
        assertTrue(JSONObject(connection.body.toString("UTF-8")).getBoolean("removeSentMedia")); assertEquals("contact=friend%2Bmusic%40example.com", connection.url.query)
    }
    @Test fun attachmentUploadNeverSendsSessionToStorage() {
        val connections = mutableListOf<Connection>()
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, if (url.host == "api.danzstak.com") """{"uploadUrl":"https://media.s3.us-west-1.amazonaws.com/messages/test/file.mp4","mediaKey":"messages/test/file.mp4","mediaType":"video"}""" else "").also { connections.add(it) } }) { "opaque" }
        val file = java.io.File.createTempFile("danzstak-upload-test", ".mp4")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3))
            val ticket = api.uploadMessageMedia(file, "video/mp4")
            val body = JSONObject(connections.first().body.toString("UTF-8")); assertEquals("message", body.getString("purpose"))
            val upload = connections.last(); assertEquals("PUT", upload.requestMethod); assertNull(upload.getRequestProperty("Authorization")); assertFalse(upload.instanceFollowRedirects)
            assertArrayEquals(byteArrayOf(1, 2, 3), upload.body.toByteArray()); assertEquals("video", ticket.getString("mediaType"))
        } finally { file.delete() }
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
    @Test fun tourRequestsUseExistingOpaqueSessionAndPreservePlanPayload() {
        val requests = mutableListOf<Connection>()
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, if (url.path == "/tour/route") """{"route":{"distanceMiles":12},"candidates":[]}""" else if (url.path == "/tours") """{"tours":[]}""" else "{}").also { requests.add(it) } }) { "opaque-native-session" }
        assertTrue(api.tours().isEmpty())
        val plan = JSONObject().put("artist", "Test act").put("start", "Test city").put("mode", "local")
        assertEquals(12, api.planTour(plan).getJSONObject("route").getInt("distanceMiles"))
        assertEquals(35000, requests.last().readTimeout)
        api.saveTour(plan.put("name", "Test plan"))
        assertEquals(listOf("/tours", "/tour/route", "/tours"), requests.map { it.url.path })
        assertEquals("POST", requests.last().requestMethod)
        assertEquals("Test plan", JSONObject(requests.last().body.toString("UTF-8")).getString("name"))
        assertTrue(requests.all { it.getRequestProperty("Authorization") == "Bearer opaque-native-session" && it.getRequestProperty("Origin") == "https://www.danzstak.com" && !it.instanceFollowRedirects && it.closed })
    }
    @Test fun profileEditorSavesAllPwaFieldsAndRemovalKeys() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, """{"profile":{"name":"Native Artist","handle":"native_artist"}}""").also { connection = it } }) { "opaque-native-session" }
        val changes = JSONObject().put("name", "Native Artist").put("handle", "native_artist").put("bio", "Original music").put("location", "Oakland").put("work", "Musician").put("website", "https://example.com").put("profilePostPermission", "friends").put("allowTags", false).put("coverX", 23).put("coverY", 76).put("coverFit", true).put("avatarKey", "").put("coverKey", "")
        assertEquals("Native Artist", api.saveProfile(changes).getString("name"))
        assertEquals("/profiles", connection.url.path); assertEquals("POST", connection.requestMethod)
        val sent = JSONObject(connection.body.toString("UTF-8"))
        assertEquals(changes.toString(), sent.toString()); assertEquals("Bearer opaque-native-session", connection.getRequestProperty("Authorization")); assertFalse(connection.instanceFollowRedirects)
    }
    @Test fun profileMediaUsesProfilePurposeAndNeverSendsSessionToStorage() {
        val requests = mutableListOf<Connection>()
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, if (url.host == "api.danzstak.com") """{"uploadUrl":"https://bucket.s3.us-west-1.amazonaws.com/users/owner/photo.jpg","mediaKey":"users/owner/photo.jpg","mediaType":"image"}""" else "").also { requests.add(it) } }) { "opaque-native-session" }
        val file = java.io.File.createTempFile("native-profile", ".jpg")
        try {
            file.writeBytes(byteArrayOf(1, 2, 3, 4)); api.uploadProfileMedia(file, "image/jpeg")
            assertEquals("profile", JSONObject(requests.first().body.toString("UTF-8")).getString("purpose"))
            assertEquals("PUT", requests.last().requestMethod); assertNull(requests.last().getRequestProperty("Authorization")); assertNull(requests.last().getRequestProperty("Cookie")); assertFalse(requests.last().instanceFollowRedirects); assertArrayEquals(file.readBytes(), requests.last().body.toByteArray())
        } finally { file.delete() }
    }
    @Test fun profileConflictsPreserveTheServersSuggestedAlternative() {
        val api = DanzStakApi(openConnection = { url -> Connection(url, 409, """{"error":"That username is already taken. Try native_artist2 or another name.","suggestion":"native_artist2"}""") }) { "opaque-native-session" }
        val error = assertThrows(IllegalStateException::class.java) { api.saveProfile(JSONObject().put("handle", "native_artist")) }
        assertTrue(error.message.orEmpty().contains("native_artist2"))
    }
    @Test fun profileVideoReadAndRemovalUseTheAuthenticatedProfileEndpoint() {
        val requests = mutableListOf<Connection>()
        val api = DanzStakApi(openConnection = { url -> Connection(url, 200, "{}").also { requests.add(it) } }) { "opaque-native-session" }
        api.profileVideo("friend+music@example.com"); api.saveProfileVideo("")
        assertEquals("/profile-video", requests.first().url.path); assertTrue(requests.first().url.query.contains("%2B"))
        assertEquals("POST", requests.last().requestMethod); assertEquals("", JSONObject(requests.last().body.toString("UTF-8")).getString("mediaKey"))
    }
    @Test fun commentRepliesSendOnlyTheExplicitParentAndReadItsAcknowledgement() {
        lateinit var connection: Connection
        val api = DanzStakApi(openConnection = { url -> Connection(url, 201, """{"comment":{"commentId":"c2","parentCommentId":"c1"}}""").also { connection = it } }) { "opaque-native-session" }
        val reply = api.comment("post", "Reply text", "c1")
        val body = JSONObject(connection.body.toString("UTF-8"))
        assertEquals("c1", body.getString("parentCommentId")); assertEquals("c1", reply.getString("parentCommentId")); assertFalse(body.has("replyToName")); assertEquals("Bearer opaque-native-session", connection.getRequestProperty("Authorization"))
        api.comment("post", "New root comment")
        assertFalse(JSONObject(connection.body.toString("UTF-8")).has("parentCommentId"))
    }
}
