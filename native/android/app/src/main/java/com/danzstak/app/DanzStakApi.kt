package com.danzstak.app

import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class FeedPost(
    val id: String, val author: String, val text: String, val createdAt: String,
    val picture: String = "", val owner: Boolean = false, val mediaUrl: String = "",
    val mediaType: String = "", val location: String = "", val tags: List<TaggedMember> = emptyList(), val userEmail: String = ""
)
data class TaggedMember(val id: String, val name: String, val isMe: Boolean = false)
data class TagFriend(val id: String, val name: String, val picture: String = "")
data class MediaPage(val id: String, val author: String, val caption: String, val url: String = "", val type: String = "", val post: FeedPost? = null)
class SessionExpired : Exception("Your session expired. Log in again.")

class DanzStakApi(private val openConnection: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection }, private val session: () -> String?) {
    private val base = "https://api.danzstak.com"
    fun exchange(code: String, verifier: String): String = request("/auth/mobile-session", "POST", JSONObject().put("code", code).put("verifier", verifier).put("platform", "android"), false).getString("sessionToken")
    fun sessionValid(): Boolean = request("/auth/session").optBoolean("authenticated", false)
    fun posts(): List<FeedPost> = objects(request("/secure-posts").optJSONArray("posts")).map { item ->
        FeedPost(item.getString("postId"), item.optString("authorName", "DanzStak member"), item.optString("content"), item.optString("createdAt"),
            item.optString("authorPicture"), item.optBoolean("isOwner"), item.optString("mediaUrl"), item.optString("mediaType"), item.optString("location"),
            objects(item.optJSONArray("taggedUsers")).map { TaggedMember(it.getString("memberId"), it.optString("name"), it.optBoolean("isMe")) }, item.optString("userEmail"))
    }
    fun publish(text: String, location: String): String = request("/secure-posts", "POST", JSONObject().put("content", text).put("location", location).put("audience", "public").put("originalContentCertified", true)).getString("postId")
    fun profile(email: String = ""): JSONObject = request("/profiles" + if (email.isBlank()) "" else "?email=" + URLEncoder.encode(email, "UTF-8")).getJSONObject("profile")
    fun logout() { request("/auth/logout", "POST", JSONObject()) }
    fun engagement(id: String): JSONObject = request("/engagement?postId=" + URLEncoder.encode(id, "UTF-8"))
    fun react(id: String, reaction: String) { request("/reactions", "POST", JSONObject().put("postId", id).put("reaction", reaction)) }
    fun comment(id: String, text: String) { request("/comments", "POST", JSONObject().put("postId", id).put("content", text)) }
    fun stories(): Pair<List<MediaPage>, List<MediaPage>> {
        val data = request("/stories")
        val flashes = objects(data.optJSONArray("stories")).map { MediaPage(it.getString("storyId"), it.optString("displayName", "DanzStak member"), it.optString("caption", it.optString("content")), it.optString("mediaUrl"), it.optString("mediaType")) }
        val roll = objects(data.optJSONArray("reels")).map { MediaPage(it.getString("id"), it.optString("displayName", "DanzStak member"), it.optString("caption"), it.optString("url"), "video") }
        return Pair(flashes, roll)
    }
    fun groupMemberships(): Set<String> { val ids = request("/groups/membership", "POST", JSONObject().put("action", "list")).optJSONArray("groupIds"); return (0 until (ids?.length() ?: 0)).map { ids!!.getString(it) }.toSet() }
    fun joinGroup(id: String, joined: Boolean) { request("/groups/membership", "POST", JSONObject().put("groupId", id).put("joined", joined)) }
    fun createGroup(name: String, category: String): JSONObject = request("/groups", "POST", JSONObject().put("name", name).put("category", category).put("description", "A new DanzStak community group.").put("communityStandards", true)).getJSONObject("group")
    fun deleteGroup(id: String) { require(id.matches(Regex("[a-f0-9-]{36}"))); request("/groups/$id", "DELETE") }
    fun reportGroup(id: String, details: String) { request("/reports", "POST", JSONObject().put("targetType", "group").put("groupId", id).put("reason", "other").put("details", details)) }
    fun groups(): List<JSONObject> = objects(request("/groups").optJSONArray("groups"))
    fun notices(): List<JSONObject> = objects(request("/engagement-notifications").optJSONArray("notifications"))
    fun markNoticesRead() { request("/engagement-notifications/read", "POST", JSONObject()) }
    fun tagFriends(): List<TagFriend> = objects(request("/calls/directory").optJSONArray("users")).filter { it.optString("friendStatus") == "friends" }.map { TagFriend(it.getString("memberId"), it.optString("name"), it.optString("picture")) }
    fun editTags(id: String, tags: List<TaggedMember>, location: String) { request("/secure-posts/${postID(id)}", "PATCH", JSONObject().put("taggedMembers", JSONArray(tags.map { it.id })).put("location", location)) }
    fun removeOwnTag(id: String) { request("/secure-posts/${postID(id)}", "PATCH", JSONObject().put("removeOwnTag", true)) }
    fun settings(): JSONObject = request("/settings/presence")
    fun saveTagConsent(settings: JSONObject, allowed: Boolean) {
        request("/settings/presence", "POST", JSONObject().put("allowTags", allowed).put("onlineVisible", settings.optBoolean("onlineVisible", true)).put("darkMode", settings.optBoolean("darkMode", false)).put("reduceMotion", settings.optBoolean("reduceMotion", false)).put("dataSaver", settings.optBoolean("dataSaver", false)).put("language", settings.optString("language", "en")))
    }
    fun conversations(): List<JSONObject> = objects(request("/conversations").optJSONArray("conversations"))
    fun chatContacts(): List<JSONObject> = objects(request("/calls/directory").optJSONArray("users")).filter { it.optString("friendStatus") == "friends" || it.optBoolean("sharedGroup") }
    fun messages(contact: String, before: String = ""): JSONObject = request("/messages?contact=" + URLEncoder.encode(contact, "UTF-8") + "&read=1" + if (before.isNotEmpty()) "&before=" + URLEncoder.encode(before, "UTF-8") else "")
    fun uploadMessageMedia(file: java.io.File, contentType: String): JSONObject {
        require(file.length() in 1..100L * 1024 * 1024) { "Choose a file smaller than 100 MB." }
        val ticket = request("/stories", "POST", JSONObject().put("purpose", "message").put("contentType", contentType))
        val url = URL(ticket.getString("uploadUrl"))
        require(url.protocol == "https" && url.host.endsWith(".amazonaws.com") && ticket.getString("mediaKey").startsWith("messages/")) { "Upload service returned an invalid destination." }
        val connection = openConnection(url)
        try {
            connection.instanceFollowRedirects = false; connection.requestMethod = "PUT"; connection.doOutput = true
            connection.connectTimeout = 10000; connection.readTimeout = 90000
            connection.setRequestProperty("Content-Type", contentType); connection.setFixedLengthStreamingMode(file.length())
            connection.outputStream.use { output -> file.inputStream().use { it.copyTo(output) } }
            check(connection.responseCode in 200..299) { "The attachment could not be uploaded. Try again." }
        } finally { connection.disconnect() }
        return ticket
    }
    fun sendMessage(contact: String, text: String, mediaKey: String = "", mediaType: String = ""): JSONObject = request("/messages", "POST", JSONObject().put("recipientEmail", contact).put("content", text).put("mediaKey", mediaKey).put("mediaType", mediaType)).getJSONObject("message")
    fun deleteMessage(contact: String, message: String, scope: String) { request("/messages", "POST", JSONObject().put("action", "delete").put("contactEmail", contact).put("messageId", message).put("scope", scope)) }
    fun editMessage(contact: String, message: String, text: String): JSONObject = request("/messages", "POST", JSONObject().put("action", "edit").put("contactEmail", contact).put("messageId", message).put("content", text)).getJSONObject("message")
    fun reactMessage(contact: String, message: String, reaction: String) { request("/messages", "POST", JSONObject().put("action", "reaction").put("contactEmail", contact).put("messageId", message).put("reaction", reaction)) }
    private fun postID(value: String): String { require(value.matches(Regex("[a-fA-F0-9-]{36}"))); return value }
    private fun request(path: String, method: String = "GET", body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        val url = URL(base + path)
        require(url.protocol == "https" && url.host == "api.danzstak.com")
        val token = if (authenticated) session() ?: throw SessionExpired() else null
        val connection = openConnection(url)
        try {
            connection.instanceFollowRedirects = false
            connection.requestMethod = method
            connection.connectTimeout = 10_000; connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Origin", "https://www.danzstak.com")
            if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
            if (body != null) {
                connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (authenticated && status == 401) throw SessionExpired()
            if (status !in 200..299) throw IllegalStateException(runCatching { JSONObject(text).optString("error") }.getOrNull().orEmpty().ifBlank { "DanzStak request failed ($status). Try again." })
            return if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally { connection.disconnect() }
    }
    companion object {
        fun objects(array: JSONArray?): List<JSONObject> = if (array == null) emptyList() else (0 until array.length()).mapNotNull { array.optJSONObject(it) }
    }
}
