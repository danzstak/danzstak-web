package com.danzstak.app

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class FeedPost(
    val author: String,
    val text: String,
    val createdAt: String,
    val mediaUrl: String,
    val mediaType: String
)

class DanzStakApi(private val session: () -> String?) {
    private val base = "https://api.danzstak.com"

    fun exchange(code: String, verifier: String): String {
        val body = JSONObject().put("code", code).put("verifier", verifier).put("platform", "android")
        val result = request("/auth/mobile-session", "POST", body, authenticated = false)
        return result.getString("sessionToken")
    }

    fun sessionValid(): Boolean = request("/auth/session").optBoolean("authenticated", false)

    fun posts(): List<FeedPost> {
        val body = request("/secure-posts")
        val items = body.optJSONArray("posts") ?: body.optJSONArray("items") ?: return emptyList()
        return (0 until items.length()).mapNotNull { index ->
            val item = items.optJSONObject(index) ?: return@mapNotNull null
            FeedPost(
                item.optString("authorName", "DanzStak Member"),
                item.optString("text", item.optString("content")),
                item.optString("createdAt"),
                item.optString("mediaUrl"),
                item.optString("mediaType")
            )
        }
    }

    fun publish(text: String) {
        request("/secure-posts", "POST", JSONObject()
            .put("content", text)
            .put("audience", "public")
            .put("originalContentCertified", true))
    }

    fun logout() { request("/auth/logout", "POST", JSONObject()) }

    private fun request(path: String, method: String = "GET", body: JSONObject? = null, authenticated: Boolean = true): JSONObject {
        val connection = (URL(base + path).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            if (authenticated) {
                val token = session() ?: throw IllegalStateException("Sign in required")
                setRequestProperty("Authorization", "Bearer $token")
            }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
        }
        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        if (status !in 200..299) throw IllegalStateException(runCatching { JSONObject(text).optString("error") }.getOrNull().orEmpty().ifBlank { "DanzStak request failed ($status)" })
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }
}
