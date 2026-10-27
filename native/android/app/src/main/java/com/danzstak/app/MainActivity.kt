package com.danzstak.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.security.SecureRandom
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*
import java.security.MessageDigest

class MainActivity : Activity() {
    private lateinit var store: SessionStore
    private lateinit var api: DanzStakApi
    private lateinit var status: TextView
    private lateinit var feed: LinearLayout
    private lateinit var login: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SessionStore(this)
        api = DanzStakApi { store.get("session") }
        buildUi()
        handleDeepLink(intent)
        if (store.get("session") != null) refreshFeed() else showSignedOut()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(12))
            setBackgroundColor(Color.rgb(244, 246, 249))
        }
        val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        header.addView(TextView(this).apply {
            text = "DanzStak"; textSize = 25f; setTextColor(Color.rgb(25, 32, 45)); setTypeface(typeface, 1)
        }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        login = Button(this).apply { setOnClickListener { if (store.get("session") == null) startLogin() else signOut() } }
        header.addView(login)
        root.addView(header)
        status = TextView(this).apply { setPadding(0, dp(8), 0, dp(8)); textSize = 14f }
        root.addView(status)

        val composer = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.BOTTOM }
        val input = EditText(this).apply { hint = "What's on your mind?"; minLines = 2; maxLines = 5 }
        composer.addView(input, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        composer.addView(Button(this).apply {
            text = "Post"
            setOnClickListener {
                val message = input.text.toString().trim()
                if (message.isNotEmpty()) background("Publishing…") { api.publish(message); runOnUiThread { input.text.clear() }; refreshFeed() }
            }
        })
        root.addView(composer)

        feed = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        root.addView(ScrollView(this).apply { addView(feed) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun startLogin() {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = bytes.joinToString("") { "%02x".format(it) }
        val challenge = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()).joinToString("") { "%02x".format(it) }
        store.put("verifier", verifier)
        val url = "https://api.danzstak.com/auth/mobile-login?platform=android&challenge=$challenge"
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri = intent?.data ?: return
        if (uri.scheme != "danzstak" || uri.host != "android" || uri.path != "/auth") return
        val code = uri.getQueryParameter("code") ?: return
        val verifier = store.get("verifier") ?: return showError("This login was started on another device.")
        background("Finishing secure login…") {
            val token = api.exchange(code, verifier)
            store.put("session", token)
            store.remove("verifier")
            refreshFeed()
        }
    }

    private fun refreshFeed() = background("Loading feed…") {
        if (!api.sessionValid()) throw IllegalStateException("Your session expired. Sign in again.")
        val posts = api.posts()
        runOnUiThread {
            login.text = "Logout"
            status.text = if (posts.isEmpty()) "Your feed is ready. Be the first to post." else "${posts.size} posts"
            feed.removeAllViews()
            posts.forEach { post ->
                feed.addView(LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(14), dp(12), dp(14), dp(12))
                    setBackgroundColor(Color.WHITE)
                    addView(TextView(this@MainActivity).apply { text = post.author; textSize = 17f; setTypeface(typeface, 1) })
                    addView(TextView(this@MainActivity).apply { text = post.text; textSize = 16f; setPadding(0, dp(8), 0, dp(6)) })
                    addView(TextView(this@MainActivity).apply { text = post.createdAt; textSize = 12f; setTextColor(Color.DKGRAY) })
                }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { setMargins(0, 0, 0, dp(10)) })
            }
        }
    }

    private fun signOut() = background("Signing out…") {
        runCatching { api.logout() }
        store.clear()
        runOnUiThread { showSignedOut() }
    }

    private fun showSignedOut() { login.text = "Log in"; status.text = "Log in to see your DanzStak feed."; feed.removeAllViews() }
    private fun showError(message: String) { runOnUiThread { status.text = message; Toast.makeText(this, message, Toast.LENGTH_LONG).show() } }
    private fun background(message: String, work: () -> Unit) {
        status.text = message
        Thread { try { work() } catch (error: Exception) { showError(error.message ?: "Something went wrong.") } }.start()
    }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
