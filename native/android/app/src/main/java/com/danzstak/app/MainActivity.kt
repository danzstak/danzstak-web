package com.danzstak.app

import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.*
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {
    private lateinit var store: SessionStore
    private lateinit var api: DanzStakApi
    private var footerView: View? = null
    private var brandedHeader: View? = null
    private var chatDark = false
    private var dictationInput: EditText? = null
    private var dictationContact: String? = null
    private var dictationEpoch = 0
    private val speechInput = registerForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { result ->
        val target = dictationInput
        if (result.resultCode == RESULT_OK && dictationEpoch == epoch && selectedChat?.optString("contactEmail") == dictationContact && target != null) {
            val spoken = result.data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty().trim()
            if (spoken.isNotEmpty()) {
                val current = target.text.toString()
                val merged = if (current.isBlank()) spoken else current.trimEnd() + " " + spoken
                if (merged.length <= 2000) { target.setText(merged); target.setSelection(target.text.length); status.text = "Review your words, then tap Send." }
                else status.text = "Speech exceeds the 2,000-character message limit. Your existing draft is unchanged."
            }
        }
        dictationInput = null; dictationContact = null
    }
    private lateinit var root: LinearLayout
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private val executor = Executors.newFixedThreadPool(3)
    private val imageExecutor = Executors.newFixedThreadPool(2)
    private val orange = Color.rgb(44, 82, 255)
    private val ink = Color.rgb(29, 34, 43)
    private val canvas = Color.rgb(242, 242, 248)
    @Volatile private var epoch = 0
    private lateinit var messageAlerts: MessageAlerts
    private val alertHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val alertPoll = object : Runnable { override fun run() {
        if (!demo && store.get("session") != null) {
            val current = epoch; val chat = selectedChat; val contact = chat?.optString("contactEmail"); val previous = chatMessages[contact].orEmpty().map { it.optString("messageId") }.toSet()
            executor.execute {
                val chats = runCatching { api.conversations() }.getOrNull()
                val messages = if (contact != null) runCatching { api.messages(contact) }.getOrNull() else null
                runOnUiThread {
                    if (current == epoch && !isDestroyed) {
                        if (chats != null) messageAlerts.update(chats)
                        if (messages != null && selectedChat?.optString("contactEmail") == contact) {
                            val old = chatMessages[contact].orEmpty()
                            val latest = DanzStakApi.objects(messages.optJSONArray("messages")).filter { "$contact:${it.optString("messageId")}" !in locallyDeletedMessages }
                            val ids = latest.map { it.optString("messageId") }.toSet()
                            val start = messages.optString("windowStart").ifEmpty { messages.optString("nextCursor") }; val complete = messages.optString("nextCursor").isEmpty()
                            val merged = old.filter { val id = it.optString("messageId"); id !in ids && (id !in previous || (!complete && start.isNotEmpty() && id < start)) } + latest
                            val ordered = merged.sortedBy { it.optString("messageId") }
                            chatMessages[contact!!] = ordered.toMutableList(); renderChatMessages?.invoke(ordered)
                        }
                    }
                }
            }
        }
        alertHandler.postDelayed(this, 15000)
    } }
    private var demo = false
    private var tab = "Home"
    private var query = ""
    private var posts = listOf<FeedPost>()
    private var flashes = listOf<MediaPage>()
    private var roll = listOf<MediaPage>()
    private val engagement = mutableMapOf<String, JSONObject>()
    private val localMedia = mutableMapOf<String, JSONObject>()
    private var friends = listOf<TagFriend>()
    private var composerTags = listOf<TaggedMember>()
    private var composerLocation = ""
    private var publishing = false
    private var media: List<MediaPage>? = null
    private var mediaIndex = 0
    private var video: VideoView? = null
    private var mediaStartY = 0f
    private val headerPercent = 6
    private val prefs by lazy { getSharedPreferences("danzstak_drafts", MODE_PRIVATE) }
    private val draftKey get() = if (demo) "demo_draft" else "post_draft"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = SessionStore(this); api = DanzStakApi { store.get("session") }; messageAlerts = MessageAlerts(this)
        window.statusBarColor = canvas; window.navigationBarColor = Color.WHITE
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply { isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = true }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) { override fun handleOnBackPressed() { goBack() } })
        if (BuildConfig.DEBUG && (intent.getBooleanExtra("preview", false) || savedInstanceState?.getBoolean("preview") == true)) enterDemo()
        else {
            showApp()
            if (!handleDeepLink(intent) && store.get("session") != null) refresh()
        }
    }
    override fun onSaveInstanceState(outState: Bundle) { outState.putBoolean("preview", demo); super.onSaveInstanceState(outState) }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); handleDeepLink(intent) }
    override fun onPause() { alertHandler.removeCallbacks(alertPoll); video?.pause(); super.onPause() }
    override fun onResume() { super.onResume(); alertHandler.post(alertPoll); if (media != null) video?.start() }
    override fun onDestroy() { video?.stopPlayback(); executor.shutdownNow(); imageExecutor.shutdownNow(); super.onDestroy() }
    private fun goBack() { if (media != null) { stopMedia(); showApp() } else if (selectedChat != null) { chats() } else { tab = "Home"; showApp() } }
    private fun signedIn() = demo || store.get("session") != null

    private fun showApp() {
        chatDark = false; footerView = null; brandedHeader = null
        window.navigationBarColor = canvas
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply { isAppearanceLightStatusBars = true; isAppearanceLightNavigationBars = true }
        selectedChat = null; renderChatMessages = null
        stopMedia()
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; setBackgroundColor(canvas)
            setOnApplyWindowInsetsListener { view, insets ->
                if (Build.VERSION.SDK_INT >= 30) { val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars()); val keyboard = insets.getInsets(android.view.WindowInsets.Type.ime()); view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom)) }
                else { @Suppress("DEPRECATION") view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom) }
                insets
            }
        }
        val header = row().apply { setBackgroundColor(Color.BLACK); gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), 0, dp(8), 0) }
        header.addView(ImageView(this).apply { setImageResource(R.drawable.danzstak_brand); scaleType = ImageView.ScaleType.FIT_CENTER; contentDescription = "DanzStak" }, LinearLayout.LayoutParams(dp(86), dp(44)))
        header.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        header.addView(headerIcon(R.drawable.import_data, "Import Facebook data") { importGuide() })
        header.addView(headerIcon(R.drawable.search, "Search") { search() })
        header.addView(headerIcon(R.drawable.messages, "Messages") { chats() })
        brandedHeader = header
        root.addView(header, LinearLayout.LayoutParams(-1, maxOf(dp(48), resources.displayMetrics.heightPixels * headerPercent / 100)))
        status = label(if (demo) "Preview · Changes stay on this device" else if (!signedIn()) "Log in to find your people." else "", 12).apply { setPadding(dp(16), dp(3), dp(16), dp(3)) }
        if (demo) { root.removeView(header); status.setBackgroundColor(Color.rgb(255, 246, 206)); root.addView(status); root.addView(header) } else root.addView(status)
        content = column()
        root.addView(ScrollView(this).apply { isFillViewport = true; addView(content) }, LinearLayout.LayoutParams(-1, 0, 1f))
        if (!signedIn()) {
            val box = card(); box.addView(label("Find your people. Feel your scene.", 25, true)); box.addView(label("Your music. Your community. Your Mix.", 17)); box.addView(button("Log in") { startLogin() }); box.addView(button("Explore the demo") { enterDemo() }); content.addView(box)
        } else {
            when (tab) { "Home" -> home(); "People" -> people(); "Create" -> composer(); "Alerts" -> alerts(); "Menu" -> menu(); "Profile" -> profile(); "Tribes" -> tribes() }
            val footer = row().apply { background = rounded(Color.WHITE); elevation = dp(6).toFloat() }
            listOf("Home" to R.drawable.home, "People" to R.drawable.people, "Create" to R.drawable.create, "Alerts" to R.drawable.alerts, "Menu" to R.drawable.menu).forEach { (name, resource) ->
                footer.addView(column().apply {
                    gravity = Gravity.CENTER; contentDescription = name; isFocusable = true
                    addView(ImageView(this@MainActivity).apply { setImageResource(resource); setColorFilter(if (tab == name) orange else ink) }, LinearLayout.LayoutParams(dp(23), dp(23)))
                    addView(label(name, 11).apply { setPadding(0, dp(3), 0, 0); gravity = Gravity.CENTER; setTextColor(if (tab == name) orange else ink) })
                    setOnClickListener { tab = name; query = ""; showApp() }
                }, LinearLayout.LayoutParams(0, dp(58), 1f))
            }
            footerView = footer
            root.addView(footer, LinearLayout.LayoutParams(-1, dp(58)).apply { setMargins(dp(16), dp(6), dp(16), dp(8)) })
        }
        setContentView(root)
    }
    private fun home() {
        val compose = row().apply {
            background = rounded(Color.WHITE); setPadding(dp(12), dp(9), dp(12), dp(9))
            val own = avatar("You", ""); own.layoutParams = LinearLayout.LayoutParams(dp(32), dp(32)); addView(own)
            addView(label("What’s on your mind?", 14).apply { setTextColor(Color.GRAY) }, LinearLayout.LayoutParams(0, -2, 1f))
            addView(ImageView(this@MainActivity).apply { setImageResource(R.drawable.create); setColorFilter(orange) }, LinearLayout.LayoutParams(dp(22), dp(22)))
            setOnClickListener { tab = "Create"; showApp() }; contentDescription = "Create post"
        }
        content.addView(compose, LinearLayout.LayoutParams(-1, dp(50)).apply { setMargins(dp(16), dp(8), dp(16), dp(8)) })
        rail("Flashes", flashes)
        val mixHeading = row(); mixHeading.addView(label(if (query.isBlank()) "Your Mix" else "Search results", 17, true), LinearLayout.LayoutParams(0, -2, 1f)); mixHeading.addView(label("≡ Latest", 12).apply { setTextColor(Color.GRAY) }); mixHeading.setPadding(dp(6), dp(4), dp(6), dp(4)); content.addView(mixHeading)
        if (query.isNotEmpty()) content.addView(label("Search: $query", 15))
        val filtered = posts.filter { query.isBlank() || (it.text + it.author + it.location).contains(query, true) }
        filtered.forEachIndexed { index, post -> content.addView(postCard(post)); if (index == 3 && query.isBlank()) rail("The Roll", roll) }
        if (filtered.isEmpty()) content.addView(card().apply { addView(label("Your Mix is ready", 22, true)); addView(label("No posts to show yet. Create a post or refresh.", 15)) })
        content.addView(button("Refresh Your Mix") { refresh() })
    }
    private fun postCard(post: FeedPost): LinearLayout {
        val box = card()
        val heading = row(); heading.addView(avatar(post.author, post.picture)); heading.addView(column().apply { addView(label(post.author, 16, true).apply { setPadding(dp(10), 0, dp(10), dp(2)) }); addView(label(post.createdAt.ifBlank { "Recent post" } + " · ♧", 12).apply { setTextColor(Color.GRAY); setPadding(dp(10), 0, dp(10), 0) }) }, LinearLayout.LayoutParams(0, -2, 1f))
        heading.addView(icon("⋯", "Post options") { postOptions(post) }); box.addView(heading)
        if (post.tags.isNotEmpty()) box.addView(label("With " + post.tags.joinToString { it.name }, 13))
        if (post.location.isNotEmpty()) box.addView(label("⌖ ${post.location}", 13))
        if (post.text.isNotEmpty()) box.addView(label(post.text, 17).apply { setLineSpacing(dp(3).toFloat(), 1f) })
        if (post.mediaUrl.startsWith("https://")) {
            val page = MediaPage(post.id, post.author, post.text, post.mediaUrl, post.mediaType, post)
            val image = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP; setBackgroundColor(Color.rgb(33, 36, 43)); contentDescription = "Photo or video by ${post.author}"; setOnClickListener { openMedia(listOf(page), 0) }; setOnLongClickListener { mediaOptions(page); true } }
            box.addView(image, LinearLayout.LayoutParams(-1, dp(220)))
            if (post.mediaType.startsWith("image")) loadImage(post.mediaUrl, image)
            else { image.scaleType = ImageView.ScaleType.CENTER_CROP; loadVideoFrame(post.mediaUrl, image) }
        }
        val state = engagement[post.id]
        val counts = state?.optJSONObject("reactionCounts")
        val total = counts?.keys()?.asSequence()?.sumOf { counts.optInt(it) } ?: 0
        val controls = row()
        controls.addView(action(if (state?.optString("myReaction").isNullOrEmpty()) "♡" else "♥", "Like", total, { react(post) }, { responders(post, "likes") }), LinearLayout.LayoutParams(0, dp(48), 1f))
        controls.addView(action("💬", "Comments", state?.optJSONArray("comments")?.length() ?: 0, { comments(post) }, { comments(post) }), LinearLayout.LayoutParams(0, dp(48), 1f))
        controls.addView(action("↗", "Share", 0, { share(post.text) }, { responseList("Shares", emptyList(), "Completed share identities are not supplied by the server.") }), LinearLayout.LayoutParams(0, dp(48), 1f))
        box.addView(View(this).apply { setBackgroundColor(Color.rgb(230, 230, 234)) }, LinearLayout.LayoutParams(-1, dp(1)).apply { setMargins(dp(10), dp(8), dp(10), 0) })
        box.addView(controls)
        return box
    }
    private fun people() {
        title("People")
        content.addView(label("People from your loaded posts", 14))
        posts.distinctBy { it.author }.forEach { person ->
            content.addView(button(person.author) { content.removeAllViews(); title(person.author); posts.filter { it.author == person.author }.forEach { content.addView(postCard(it)) } })
        }
    }
    private fun menu() {
        title("Menu")
        val items = card()
        fun item(name: String, resource: Int, action: () -> Unit) {
            items.addView(row().apply {
                setPadding(dp(12), 0, dp(12), 0); minimumHeight = dp(49); contentDescription = name
                addView(ImageView(this@MainActivity).apply { setImageResource(resource); setColorFilter(orange) }, LinearLayout.LayoutParams(dp(23), dp(23)))
                addView(label(name, 16, true)); setOnClickListener { action() }
            })
        }
        item("Your Mix", R.drawable.home) { tab = "Home"; showApp() }
        item("My Profile", R.drawable.profile) { tab = "Profile"; showApp() }
        item("Friends", R.drawable.people) { tab = "People"; showApp() }
        item("Tribes", R.drawable.tribes) { tab = "Tribes"; showApp() }
        item("Photos", R.drawable.camera) { showMediaPosts("image", "Photos") }
        item("Videos", R.drawable.video) { showMediaPosts("video", "Videos") }
        item("Events", R.drawable.mic) { openWeb("https://www.danzstak.com/feed.html#events") }
        item("Booking Agent", R.drawable.bus) { openWeb("https://www.danzstak.com/booking.html") }
        item("Saved", R.drawable.bookmark) { openWeb("https://www.danzstak.com/feed.html#saved") }
        item("Settings", R.drawable.settings) { settingsMenu() }
        item("Support", R.drawable.support) { openWeb("https://www.danzstak.com/support.html") }
        item("Privacy Policy", R.drawable.lock) { openWeb("https://www.danzstak.com/privacy.html") }
        item("Terms of Service", R.drawable.document) { openWeb("https://www.danzstak.com/terms.html") }
        item(if (demo) "Exit demo" else "Logout", R.drawable.logout) { signOut() }
        content.addView(items)
    }
    private fun showMediaPosts(type: String, name: String) {
        content.removeAllViews(); title(name)
        val filtered = posts.filter { it.mediaType.startsWith(type) }
        if (filtered.isEmpty()) content.addView(label("No ${name.lowercase()} in your loaded posts. Refresh Your Mix for recent posts.", 15))
        filtered.forEach { content.addView(postCard(it)) }
    }
    private fun settingsMenu() {
        content.removeAllViews(); title("Settings")
        content.addView(button("Edit Profile") { editProfile() })
        content.addView(button("Import Facebook data") { importGuide() })
        content.addView(button("Enable message sounds") { messageAlerts.enable(); status.text = "Sounds follow Android notification settings." })
    }
    private fun profile() {
        title(posts.firstOrNull { it.owner }?.author ?: "Your profile")
        content.addView(button("Edit Profile") { editProfile() })
        content.addView(label("Your posts", 20, true)); posts.filter { it.owner }.forEach { content.addView(postCard(it)) }
    }
    private fun editProfile() {
        fun show(settings: JSONObject) {
            val toggle = Switch(this).apply { text = "Allow people to tag me"; isChecked = settings.optBoolean("allowTags", true); setPadding(dp(12), dp(12), dp(12), dp(12)) }
            val box = column(); box.addView(toggle); box.addView(label("Turning this off blocks new tags. Remove an existing tag by long-pressing its photo or video, or using Post options.", 14))
            val dialog = AlertDialog.Builder(this).setTitle("Edit Profile").setView(box).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create()
            dialog.setOnShowListener { dialog.getButton(-1).setOnClickListener {
                if (demo) { localConsent = toggle.isChecked; dialog.dismiss() }
                else { dialog.getButton(-1).isEnabled = false; work("Saving tagging preference…", { api.saveTagConsent(settings, toggle.isChecked) }, { dialog.dismiss(); status.text = "Tagging preference saved." }, { dialog.getButton(-1).isEnabled = true }) }
            } }; dialog.show()
        }
        if (demo) show(JSONObject().put("allowTags", localConsent)) else work("Loading profile settings…", { api.settings() }, { show(it) })
    }
    private var localConsent = true
    private fun composer() {
        title("Create post")
        content.addView(label("Public · Your post", 14))
        val input = EditText(this).apply { hint = "What’s happening in your world?"; minLines = 4; maxLines = 8; setText(prefs.getString(draftKey, "")); contentDescription = "Post text" }
        input.addTextChangedListener(watcher { prefs.edit().putString(draftKey, it).apply() }); content.addView(input)
        val metadata = label(composerTags.joinToString { it.name } + if (composerLocation.isNotEmpty()) " · $composerLocation" else "", 14); content.addView(metadata)
        content.addView(button("Tag people · Add location") { tagEditor(null) { tags, location -> composerTags = tags; composerLocation = location; metadata.text = tags.joinToString { it.name } + if (location.isNotEmpty()) " · $location" else "" } })
        val certified = CheckBox(this).apply { text = "I created this content or have permission to share it." }; content.addView(certified)
        val postButton = button("Post") {}
        postButton.setOnClickListener {
            val text = input.text.toString().trim()
            if (text.isBlank() || text.length > 5000 || !certified.isChecked) { status.text = "Enter up to 5,000 characters and confirm permission to share."; return@setOnClickListener }
            if (publishing) return@setOnClickListener
            publishing = true; postButton.isEnabled = false
            val location = composerLocation; val tags = composerTags.toList()
            if (demo) {
                posts = listOf(FeedPost("demo-${System.nanoTime()}", "You", text, "Just now", owner = true, location = location, tags = tags)) + posts
                publishing = false; finishPost()
            } else work("Publishing…", {
                val id = api.publish(text, location)
                val warning = if (tags.isNotEmpty()) runCatching { api.editTags(id, tags, location) }.exceptionOrNull() else null
                Triple(id, runCatching { api.posts() }.getOrNull(), warning != null)
            }, { result -> posts = result.second ?: (listOf(FeedPost(result.first, "You", text, "Just now", owner = true, location = location, tags = if (result.third) emptyList() else tags)) + posts); publishing = false; finishPost(); if (result.third) status.text = "Post published. People tags could not be saved; retry from Post options → Tags & location." }, { publishing = false; postButton.isEnabled = true })
        }
        content.addView(postButton)
        content.addView(label(if (demo) "Preview: saved in memory only." else "Your draft stays on this device if publishing fails.", 13))
    }
    private fun finishPost() { prefs.edit().remove(draftKey).apply(); composerTags = emptyList(); composerLocation = ""; tab = "Home"; showApp() }
    private fun tagEditor(post: FeedPost?, done: (List<TaggedMember>, String) -> Unit) {
        fun show(choices: List<TagFriend>) {
            val selected = (post?.tags ?: composerTags).toMutableList()
            val box = column(); val location = EditText(this).apply { hint = "Add a place or city"; setText(post?.location ?: composerLocation) }; box.addView(location)
            box.addView(label("Tag up to 10 friends. Their tagging privacy settings apply.", 13))
            val existing = selected.toList()
            (existing.map { TagFriend(it.id, it.name) } + choices).distinctBy { it.id }.forEach { friend ->
                box.addView(CheckBox(this).apply { text = friend.name; isChecked = selected.any { it.id == friend.id }; setOnCheckedChangeListener { button, checked ->
                    if (checked && selected.none { it.id == friend.id }) { if (selected.size >= 10) { button.isChecked = false } else selected.add(TaggedMember(friend.id, friend.name)) }
                    if (!checked) selected.removeAll { it.id == friend.id }
                } })
            }
            val dialog = AlertDialog.Builder(this).setTitle("Tags & location").setView(ScrollView(this).apply { addView(box) }).setNegativeButton("Cancel", null).setPositiveButton("Save", null).create()
            dialog.setOnShowListener { dialog.getButton(-1).setOnClickListener {
                val place = location.text.toString().trim()
                if (place.length > 120) { location.error = "Use 120 characters or fewer"; return@setOnClickListener }
                if (post == null) { done(selected.toList(), place); dialog.dismiss() }
                else if (demo) { posts = posts.map { if (it.id == post.id) it.copy(tags = selected.toList(), location = place) else it }; dialog.dismiss(); showApp() }
                else { dialog.getButton(-1).isEnabled = false; work("Saving tags…", { api.editTags(post.id, selected, place); api.posts() }, { posts = it; dialog.dismiss(); showApp() }, { dialog.getButton(-1).isEnabled = true }) }
            } }; dialog.show()
        }
        if (demo) show(listOf(TagFriend("demo-friend", "Jamie Rivera"))) else work("Loading friends…", { api.tagFriends() }, { friends = it; show(it) })
    }
    private fun postOptions(post: FeedPost) {
        val options = mutableListOf("Share")
        if (post.owner) options.add("Tags & location")
        if (post.tags.any { it.isMe }) options.add("Remove my tag")
        AlertDialog.Builder(this).setTitle("Post options").setItems(options.toTypedArray()) { _, which -> when (options[which]) {
            "Share" -> share(post.text); "Tags & location" -> tagEditor(post) { _, _ -> }; "Remove my tag" -> removeTag(post)
        } }.show()
    }
    private fun removeTag(post: FeedPost) {
        if (demo) { posts = posts.map { if (it.id == post.id) it.copy(tags = it.tags.filterNot { tag -> tag.isMe }) else it }; showApp() }
        else work("Removing your tag…", { api.removeOwnTag(post.id); api.posts() }, { posts = it; showApp() })
    }
    private fun tribes() {
        title("Tribes")
        if (demo) { content.addView(label("DJs & Producers\nTalk tracks, trade ideas and find your next collaborator.", 17)); return }
        work("Loading Tribes…", { api.groups() }, { list -> list.forEach { group -> content.addView(card().apply { addView(label(group.optString("name"), 19, true)); addView(label(group.optString("description"), 15)) }) } })
    }
    private fun alerts() {
        title("Notifications")
        fun show(items: List<JSONObject>) { if (items.isEmpty()) content.addView(label("You’re all caught up.", 17)); items.forEach { notice -> content.addView(button(notice.optString("preview", "New activity")) { posts.firstOrNull { it.id == notice.optString("postId") }?.let { post -> content.removeAllViews(); content.addView(postCard(post)) } ?: run { status.text = "Refresh Your Mix to load this post." } }) } }
        if (demo) show(emptyList()) else work("Loading notifications…", { api.notices() }, { show(it); content.addView(button("Mark read") { work("Marking read…", { api.markNoticesRead() }, { status.text = "Notifications marked read." }) }) })
    }
    private fun react(post: FeedPost) {
        val state = engagement[post.id] ?: JSONObject(); val next = if (state.optString("myReaction").isBlank()) "Like" else ""
        if (demo) { engagement[post.id] = state.put("myReaction", next).put("reactionCounts", JSONObject().put("Like", if (next.isEmpty()) 0 else 1)); showApp() }
        else work("Updating reaction…", { api.react(post.id, next); api.engagement(post.id) }, { engagement[post.id] = it; showApp() })
    }
    private fun comments(post: FeedPost) {
        fun show(state: JSONObject) {
            val box = column()
            DanzStakApi.objects(state.optJSONArray("comments")).forEach { comment -> box.addView(label("${comment.optString("authorName")}\n${comment.optString("content")}", 15)) }
            val input = EditText(this).apply { hint = "Write a comment…" }; box.addView(input)
            val dialog = AlertDialog.Builder(this).setTitle("Comments").setView(ScrollView(this).apply { addView(box) }).setNegativeButton("Done", null).setPositiveButton("Send", null).create()
            dialog.setOnShowListener { dialog.getButton(-1).setOnClickListener {
                val text = input.text.toString().trim(); if (text.isBlank() || text.length > 2000) { input.error = "Enter 1–2,000 characters"; return@setOnClickListener }
                if (demo) { val comments = state.optJSONArray("comments") ?: org.json.JSONArray(); comments.put(JSONObject().put("authorName", "You").put("content", text)); engagement[post.id] = state.put("comments", comments); dialog.dismiss(); comments(post) }
                else { dialog.getButton(-1).isEnabled = false; work("Sending comment…", { api.comment(post.id, text); api.engagement(post.id) }, { engagement[post.id] = it; dialog.dismiss(); comments(post) }, { dialog.getButton(-1).isEnabled = true }) }
            } }; dialog.show()
        }
        if (demo) show(engagement.getOrPut(post.id) { JSONObject() }) else work("Loading comments…", { api.engagement(post.id) }, { engagement[post.id] = it; show(it) })
    }
    private fun responders(post: FeedPost, kind: String) {
        val state = engagement[post.id] ?: JSONObject()
        val people = DanzStakApi.objects(state.optJSONArray("reactors")).map { Triple(it.optString("name"), it.optString("picture"), it.optString("reaction")) }.toMutableList()
        if (people.isEmpty() && state.optString("myReaction").isNotBlank()) people.add(Triple("You", "", state.optString("myReaction")))
        responseList("Likes", people, "The server may not supply the full list of people who reacted.")
    }
    private fun responseList(title: String, people: List<Triple<String, String, String>>, note: String) {
        showApp(); content.removeAllViews(); title(title); content.addView(label(note, 14))
        people.forEach { (name, picture, detail) -> content.addView(card().apply { val row = row(); row.addView(avatar(name, picture)); row.addView(label(name, 17, true), LinearLayout.LayoutParams(0, -2, 1f)); addView(row); addView(label(detail, 14)) }) }
        if (people.isEmpty()) content.addView(label("No responses to show yet.", 17))
        content.addView(button("Done") { showApp() })
    }
    private fun rail(name: String, pages: List<MediaPage>) {
        if (pages.isEmpty()) return
        content.addView(label(name, 17, true).apply { setPadding(dp(18), dp(9), dp(18), dp(9)) })
        val items = row().apply { setPadding(dp(11), 0, dp(11), 0) }
        pages.forEachIndexed { index, page ->
            val tile = FrameLayout(this).apply {
                background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(if (index % 2 == 0) orange else Color.rgb(180, 36, 213), Color.BLACK)).apply { cornerRadius = dp(14).toFloat() }
                clipToOutline = true; contentDescription = "Open $name from ${page.author}"; setOnClickListener { openMedia(pages, index) }
            }
            if (page.type.startsWith("image") && page.url.startsWith("https://")) {
                val image = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP }; tile.addView(image, FrameLayout.LayoutParams(-1, -1)); loadImage(page.url, image)
            } else {
                tile.addView(ImageView(this).apply { setImageResource(if (page.type.startsWith("video")) android.R.drawable.ic_media_play else R.drawable.waveform); setColorFilter(Color.LTGRAY) }, FrameLayout.LayoutParams(dp(34), dp(34), Gravity.CENTER))
            }
            tile.addView(label(page.author, 12, true).apply { setTextColor(Color.WHITE); setPadding(dp(10), dp(10), dp(10), dp(10)) }, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM))
            items.addView(tile, LinearLayout.LayoutParams(dp(105), dp(140)).apply { setMargins(dp(5), dp(3), dp(5), dp(8)) })
        }
        content.addView(HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(items) })
    }
    private fun openMedia(pages: List<MediaPage>, index: Int) {
        video?.stopPlayback(); video = null; media = pages; mediaIndex = index
        val page = pages[index]
        root.removeAllViews(); root.setBackgroundColor(Color.BLACK)
        val top = row(); top.addView(label("${index + 1} / ${pages.size}", 14).apply { setTextColor(Color.WHITE) }, LinearLayout.LayoutParams(0, dp(48), 1f)); top.addView(button("Done") { stopMedia(); showApp() }); root.addView(top)
        val frame = FrameLayout(this)
        if (page.url.startsWith("https://") && (page.type.startsWith("video") || page.url.substringBefore('?').matches(Regex("(?i).*\\.(mp4|mov|m4v|m3u8|webm)$")))) {
            if (page.url.substringBefore('?').matches(Regex("(?i).*\\.(mp4|mov|m4v|m3u8|webm)$"))) {
                video = VideoView(this).apply { setVideoURI(Uri.parse(page.url)); setOnPreparedListener { it.isLooping = true; start() }; setOnErrorListener { _, _, _ -> Toast.makeText(this@MainActivity, "This video could not be played.", Toast.LENGTH_LONG).show(); true } }
                frame.addView(video, FrameLayout.LayoutParams(-1, -1))
            } else frame.addView(button("Watch original video") { video?.pause(); openWeb(page.url) })
        } else if (page.url.startsWith("https://")) {
            val image = ImageView(this).apply { scaleType = ImageView.ScaleType.FIT_CENTER; contentDescription = "Media by ${page.author}" }; frame.addView(image, FrameLayout.LayoutParams(-1, -1)); loadImage(page.url, image)
        } else frame.addView(label(page.caption + "\n\nPreview · No attached media", 25, true).apply { setTextColor(Color.WHITE); gravity = Gravity.CENTER }, FrameLayout.LayoutParams(-1, -1))
        val touch = View(this).apply { contentDescription = "Swipe up for next media; long press for reactions"; isFocusable = true; setOnClickListener { if (page.url.startsWith("https://") && !page.url.substringBefore('?').matches(Regex("(?i).*\\.(mp4|mov|m4v|m3u8|webm)$")) && page.type.startsWith("video")) openWeb(page.url) }; setOnLongClickListener { mediaOptions(page); true } }
        var lastDown = 0L
        touch.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { mediaStartY = event.y; lastDown = System.currentTimeMillis(); touch.postDelayed({ if (lastDown > 0 && System.currentTimeMillis() - lastDown >= 500) { lastDown = 0; mediaOptions(page) } }, 550); true }
                MotionEvent.ACTION_UP -> { val dy = event.y - mediaStartY; if (lastDown > 0 && kotlin.math.abs(dy) > dp(60)) { val next = (index + if (dy < 0) 1 else -1).coerceIn(0, pages.lastIndex); if (next != index) openMedia(pages, next) } else if (lastDown > 0) touch.performClick(); lastDown = 0; true }
                MotionEvent.ACTION_CANCEL -> { lastDown = 0; true }
                else -> true
            }
        }
        frame.addView(touch, FrameLayout.LayoutParams(-1, -1))
        val details = column(); details.addView(label(page.author, 18, true).apply { setTextColor(Color.WHITE) }); details.addView(label(page.caption, 15).apply { setTextColor(Color.WHITE) })
        frame.addView(details, FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM or Gravity.START).apply { rightMargin = dp(72); bottomMargin = dp(16) })
        val rail = column()
        val state = localMedia.getOrPut(page.id) { JSONObject() }
        listOf("likes" to "♡", "comments" to "☏", "shares" to "↗").forEach { (kind, glyph) ->
            rail.addView(action(glyph, kind, state.optInt(kind), {
                video?.pause()
                responseList(kind.replaceFirstChar { it.uppercase() }, if (kind == "likes" && state.optInt(kind) > 0) listOf(Triple("You", "", state.optString("reaction", "Like"))) else if (kind == "comments") DanzStakApi.objects(state.optJSONArray("localComments")).map { Triple(it.optString("name"), "", it.optString("text")) } else emptyList(), "Preview activity on this device only. Community-wide Flashes and The Roll responses are not connected.")
            }, { video?.pause(); responseList(kind, emptyList(), "Community-wide media response identities are not connected.") }).apply { setTextColor(Color.WHITE); setPadding(dp(3), dp(10), dp(3), dp(10)) })
        }
        frame.addView(rail, FrameLayout.LayoutParams(dp(70), -2, Gravity.END or Gravity.CENTER_VERTICAL))
        root.addView(frame, LinearLayout.LayoutParams(-1, 0, 1f))
        val comment = EditText(this).apply { hint = "Write a comment…"; setTextColor(Color.WHITE); setHintTextColor(Color.LTGRAY); setOnFocusChangeListener { _, focused -> if (focused) video?.pause() } }
        val bottom = row(); bottom.addView(comment, LinearLayout.LayoutParams(0, dp(56), 1f)); bottom.addView(button("Send") {
            val text = comment.text.toString().trim(); if (text.isNotEmpty()) { state.put("comments", state.optInt("comments") + 1); val comments = state.optJSONArray("localComments") ?: org.json.JSONArray(); comments.put(JSONObject().put("name", "You").put("text", text)); state.put("localComments", comments); comment.text.clear(); Toast.makeText(this, "Comment added to this preview only.", Toast.LENGTH_SHORT).show() }
        }); root.addView(bottom)
    }
    private fun mediaOptions(page: MediaPage) {
        video?.pause()
        val options = mutableListOf("React 👍", "React ❤️", "React 😂", "React 😮", "React 😢")
        if (page.post?.tags?.any { it.isMe } == true) options.add("Remove my tag")
        AlertDialog.Builder(this).setTitle("Photo & video").setItems(options.toTypedArray()) { _, index ->
            if (options[index] == "Remove my tag") removeTag(page.post!!)
            else { localMedia.getOrPut(page.id) { JSONObject() }.put("liked", true).put("likes", 1).put("reaction", options[index].removePrefix("React ")); Toast.makeText(this, "Reaction saved in this preview only.", Toast.LENGTH_SHORT).show() }
        }.setOnDismissListener { if (media != null) video?.start() }.show()
    }
    private fun stopMedia() { video?.stopPlayback(); video = null; media = null }
    private var selectedChat: JSONObject? = null
    private var renderChatMessages: ((List<JSONObject>) -> Unit)? = null
    private val chatMessages = mutableMapOf<String, MutableList<JSONObject>>()
    private val locallyDeletedMessages = mutableSetOf<String>()
    private fun darkChat() {
        androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).apply { isAppearanceLightStatusBars = false; isAppearanceLightNavigationBars = false }
        chatDark = true; root.setBackgroundColor(Color.rgb(11, 20, 26)); footerView?.visibility = View.GONE; brandedHeader?.visibility = View.GONE
        window.navigationBarColor = Color.rgb(11, 20, 26)
        status.setBackgroundColor(Color.rgb(32, 44, 51)); status.setTextColor(Color.LTGRAY)
    }
    private fun chats() {
        showApp(); darkChat(); content.removeAllViews(); title("Chats"); content.addView(button("Done") { showApp() })
        if (demo) content.addView(label("Preview chats · No messages are sent", 13))
        content.addView(button("New chat") { newChat() })
        fun show(items: List<JSONObject>) {
            if (items.isEmpty()) content.addView(label("Your conversations start here. Start a chat with a friend or someone in your Tribes.", 16))
            items.forEach { chat ->
                val box = card(); val heading = row(); heading.addView(avatar(chat.optString("name"), chat.optString("picture")))
                heading.addView(label(chat.optString("name", "DanzStak member"), 17, true), LinearLayout.LayoutParams(0, -2, 1f))
                if (chat.optInt("unread") > 0) heading.addView(label(chat.optInt("unread").toString(), 14, true).apply { setTextColor(orange) })
                box.addView(heading); box.addView(label(chat.optString("preview"), 15)); box.setOnClickListener { thread(chat) }; content.addView(box)
            }
        }
        if (demo) show(listOf(JSONObject().put("contactEmail", "preview-jamie").put("name", "Jamie Rivera").put("preview", "Ready for the next set?").put("unread", 1), JSONObject().put("contactEmail", "preview-alex").put("name", "Alex Morgan").put("preview", "Let’s make something worth showing up for.")))
        else work("Loading chats…", { api.conversations() }, { show(it) })
    }
    private fun newChat(forward: String? = null) {
        fun show(contacts: List<JSONObject>) {
            AlertDialog.Builder(this).setTitle("New chat").setItems(contacts.map { it.optString("name", "DanzStak member") }.toTypedArray()) { _, which -> val contact = contacts[which]; if (forward != null) { val key = "chat.$demo.${contact.optString("email")}"; val current = prefs.getString(key, "").orEmpty(); prefs.edit().putString(key, if (current.isBlank()) forward else current.trimEnd() + "\n" + forward).apply() }; thread(JSONObject().put("contactEmail", contact.optString("email")).put("name", contact.optString("name")).put("picture", contact.optString("picture"))) }.setNegativeButton("Cancel", null).show()
            if (contacts.isEmpty()) status.text = "Add a friend or join a Tribe to start a conversation."
        }
        if (demo) show(listOf(JSONObject().put("email", "preview-jamie").put("name", "Jamie Rivera"))) else work("Loading contacts…", { api.chatContacts() }, { show(it) })
    }
    private fun thread(chat: JSONObject) {
        showApp(); darkChat(); selectedChat = chat; content.removeAllViews()
        val contact = chat.optString("contactEmail")
        val chatHeader = row().apply { setBackgroundColor(Color.rgb(32, 44, 51)); setPadding(dp(4), dp(4), dp(8), dp(4)) }
        chatHeader.addView(icon("‹", "Back to chats") { selectedChat = null; chats() }.apply { setTextColor(Color.WHITE) })
        chatHeader.addView(avatar(chat.optString("name"), chat.optString("picture")))
        chatHeader.addView(label(chat.optString("name", "DanzStak member"), 17, true), LinearLayout.LayoutParams(0, -2, 1f))
        chatHeader.addView(icon("⋮", "Chat options") { AlertDialog.Builder(this).setItems(arrayOf("Refresh conversation", "Close")) { _, which -> if (which == 0) thread(chat) else chats() }.show() }.apply { setTextColor(Color.WHITE) })
        root.addView(chatHeader, root.indexOfChild(content.parent as View), LinearLayout.LayoutParams(-1, dp(58)))
        val transcript = column(); content.addView(transcript)
        val input = EditText(this).apply { hint = "Message"; minLines = 1; maxLines = 5; setText(prefs.getString("chat.$demo.$contact", "")); contentDescription = "Message" }
        input.addTextChangedListener(watcher { prefs.edit().putString("chat.$demo.$contact", it).apply() })
        val compose = row(); compose.addView(input, LinearLayout.LayoutParams(0, -2, 1f))
        var allowed = true
        fun render(items: List<JSONObject>) {
            transcript.removeAllViews()
            items.forEach { message ->
                val own = !message.optString("senderEmail").equals(contact, true)
                val bubble = label(message.optString("content"), 16).apply {
                    background = rounded(if (own) Color.rgb(31, 61, 94) else Color.rgb(32, 44, 51))
                    layoutParams = LinearLayout.LayoutParams(-2, -2).apply { gravity = if (own) Gravity.END else Gravity.START; setMargins(if (own) dp(44) else dp(8), dp(5), if (own) dp(8) else dp(44), dp(5)) }
                    setOnLongClickListener { messageActions(chat, message); true }
                }
                transcript.addView(bubble)
                val matcher = android.util.Patterns.WEB_URL.matcher(message.optString("content"))
                var preview: String? = null
                while (matcher.find()) { val candidate = matcher.group(); if (candidate.startsWith("https://")) { preview = candidate; break } }
                if (preview != null) {
                    val url = preview
                    transcript.addView(label("↗ ${Uri.parse(url).host.orEmpty()}\n$url", 13).apply {
                        setTextColor(Color.rgb(126, 200, 255)); background = rounded(Color.rgb(32, 44, 51))
                        layoutParams = LinearLayout.LayoutParams(-2, -2).apply { gravity = if (own) Gravity.END else Gravity.START; setMargins(dp(12), 0, dp(12), dp(5)) }
                        setOnClickListener { openWeb(url) }; contentDescription = "Open link $url"
                    })
                }
                if (message.optString("editedAt").isNotEmpty()) transcript.addView(label("Edited", 11).apply { setTextColor(Color.LTGRAY) })
                val reactions = message.optJSONObject("reactionCounts")
                if (message.optString("deletedAt").isEmpty() && reactions != null && reactions.length() > 0) transcript.addView(label(reactions.keys().asSequence().joinToString(" ") { "$it ${reactions.optInt(it)}" }, 12))
            }
        }
        renderChatMessages = { render(it) }
        val send = button("➤") {}.apply { contentDescription = "Send message"; minimumWidth = dp(44); minWidth = dp(44); textSize = 20f; setTextColor(Color.WHITE); setPadding(0, 0, 0, 0); background = rounded(orange); layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)) }
        send.setOnClickListener {
            val text = input.text.toString().trim(); if (!allowed || text.isBlank() || text.length > 2000) { input.error = "Enter 1–2,000 characters"; return@setOnClickListener }
            send.isEnabled = false; send.text = "…"
            fun append(message: JSONObject) { val items = chatMessages.getOrPut(contact) { mutableListOf() }; items.add(message); render(items); input.text.clear(); send.isEnabled = true; send.text = "➤"; status.text = if (demo) "Preview · Messages stay on this device" else "Sent" }
            if (demo) append(JSONObject().put("messageId", "preview-${System.nanoTime()}").put("senderEmail", "preview-you").put("content", text))
            else work("Sending message…", { api.sendMessage(contact, text) }, { append(it) }, { send.isEnabled = true; send.text = "➤" })
        }
        val microphone = headerIcon(R.drawable.mic, "Dictate message") {
            dictationInput = input; dictationContact = contact; dictationEpoch = epoch
            try {
                speechInput.launch(Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Speak your message. Review it before sending.")
                    putExtra(android.speech.RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                })
            } catch (_: android.content.ActivityNotFoundException) {
                dictationInput = null; dictationContact = null
                status.text = "Speech input is unavailable. Enable your phone’s speech service or use your keyboard microphone."
            }
        }.apply { setColorFilter(orange) }
        compose.setPadding(dp(8), dp(6), dp(8), dp(6)); compose.setBackgroundColor(Color.rgb(11, 20, 26)); input.background = rounded(Color.rgb(32, 44, 51)); input.setPadding(dp(14), dp(10), dp(10), dp(10)); input.setTextColor(Color.rgb(233, 237, 239)); input.setHintTextColor(Color.LTGRAY)
        compose.addView(microphone); compose.addView(send); root.addView(compose, root.childCount - 1)
        if (demo) {
            val items = chatMessages.getOrPut(contact) { mutableListOf(JSONObject().put("messageId", "preview-first").put("senderEmail", contact).put("content", chat.optString("preview", "Hey! What are you working on?"))) }; render(items); status.text = "Preview · Messages stay on this device"
        } else work("Loading conversation…", { api.messages(contact) }, { result ->
            allowed = result.optBoolean("canContact", true); input.isEnabled = allowed; send.isEnabled = allowed
            val items = DanzStakApi.objects(result.optJSONArray("messages")).filter { "$contact:${it.optString("messageId")}" !in locallyDeletedMessages }; chatMessages[contact] = items.toMutableList(); render(items)
            if (!allowed) status.text = "You can read this conversation. Sending requires friendship or a shared Tribe."
            val cursor = result.optString("nextCursor")
            if (cursor.isNotEmpty()) transcript.addView(button("Load earlier messages") { work("Loading earlier messages…", { api.messages(contact, cursor) }, { older -> val combined = (DanzStakApi.objects(older.optJSONArray("messages")) + chatMessages[contact].orEmpty()).distinctBy { it.optString("messageId") }; chatMessages[contact] = combined.toMutableList(); render(combined) }) }, 0)
        })
    }
    private fun messageActions(chat: JSONObject, message: JSONObject) {
        (getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager).hideSoftInputFromWindow(root.windowToken, 0)
        val contact = chat.optString("contactEmail")
        val own = !message.optString("senderEmail").equals(contact, true)
        val deleted = message.optString("deletedAt").isNotEmpty()
        val editable = own && !deleted
        val context = android.view.ContextThemeWrapper(this, android.R.style.Theme_Material_Dialog_Alert)
        val box = column().apply { setPadding(dp(14), dp(8), dp(14), dp(8)) }
        lateinit var dialog: AlertDialog
        val reactions = row()
        listOf("👍", "❤️", "😂", "😮", "😢", "😡").forEach { emoji ->
            reactions.addView(TextView(context).apply {
                text = emoji; textSize = 24f; gravity = Gravity.CENTER; contentDescription = "React with $emoji"
                setOnClickListener {
                    if (demo) { message.put("myReaction", emoji).put("reactionCounts", JSONObject().put(emoji, 1)); dialog.dismiss(); renderChatMessages?.invoke(chatMessages[contact].orEmpty()) }
                    else work("Saving reaction…", { api.reactMessage(contact, message.getString("messageId"), emoji) }, { dialog.dismiss(); thread(chat) })
                }
            }, LinearLayout.LayoutParams(0, dp(48), 1f))
        }
        if (!deleted) box.addView(reactions)
        val editor = EditText(context).apply { setText(message.optString("content")); minLines = 2; maxLines = 7; setTextColor(Color.WHITE); contentDescription = "Edit message" }
        if (editable) box.addView(editor) else box.addView(label(message.optString("content"), 16))
        val actions = row()
        actions.addView(button("Copy") { (getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager).setPrimaryClip(android.content.ClipData.newPlainText("DanzStak message", message.optString("content"))); dialog.dismiss() }, LinearLayout.LayoutParams(0, -2, 1f))
        actions.addView(button("Share") { dialog.dismiss(); share(message.optString("content")) }, LinearLayout.LayoutParams(0, -2, 1f))
        actions.addView(button("Forward") { dialog.dismiss(); newChat(message.optString("content")) }, LinearLayout.LayoutParams(0, -2, 1f))
        if (!deleted) box.addView(actions)
        fun delete(scope: String) {
            fun perform() {
                fun applyDelete() {
                    locallyDeletedMessages.add("$contact:${message.optString("messageId")}")
                    chatMessages[contact]?.removeAll { it.optString("messageId") == message.optString("messageId") }
                    dialog.dismiss(); renderChatMessages?.invoke(chatMessages[contact].orEmpty())
                }
                if (demo) applyDelete()
                else work("Deleting message…", { api.deleteMessage(contact, message.getString("messageId"), scope) }, { applyDelete() })
            }
            if (scope == "everyone") AlertDialog.Builder(context).setTitle("Delete for everyone?").setMessage("Remove this message text for everyone in this conversation?").setNegativeButton("Cancel", null).setPositiveButton("Delete") { _, _ -> perform() }.show()
            else perform()
        }
        box.addView(button("Delete for me") { delete("me") })
        if (own && !deleted) box.addView(button("Delete for everyone") { delete("everyone") })
        val builder = AlertDialog.Builder(context).setTitle(if (editable) "Edit message" else "Message").setView(ScrollView(context).apply { addView(box) }).setNegativeButton("Cancel", null)
        if (editable) builder.setPositiveButton("Save", null)
        dialog = builder.create()
        dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
        dialog.setOnShowListener { if (editable) dialog.getButton(-1).setOnClickListener {
            val text = editor.text.toString().trim()
            if (text.isEmpty() || text.length > 2000) { editor.error = "Enter 1–2,000 characters"; return@setOnClickListener }
            if (demo) { message.put("content", text).put("editedAt", java.time.Instant.now().toString()); dialog.dismiss(); renderChatMessages?.invoke(chatMessages[contact].orEmpty()) }
            else { dialog.getButton(-1).isEnabled = false; work("Saving message…", { api.editMessage(contact, message.getString("messageId"), text) }, { updated -> message.put("content", updated.getString("content")).put("editedAt", updated.optString("editedAt")); dialog.dismiss(); renderChatMessages?.invoke(chatMessages[contact].orEmpty()) }, { dialog.getButton(-1).isEnabled = true }) }
        } }
        dialog.show()
    }
    private fun importGuide() { AlertDialog.Builder(this).setTitle("Import Facebook data").setMessage("1. In Facebook, open Settings → Accounts Center → Your information and permissions.\n\n2. Download or export your information to your device. Choose JSON and select your posts, photos and videos.\n\n3. Download the ZIP when Facebook says it is ready.\n\n4. Open DanzStak’s website menu → Import Facebook data. Review the selected items and audience before importing. Imported posts default to Public.").setNegativeButton("Done", null).setPositiveButton("Open DanzStak") { _, _ -> openWeb("https://www.danzstak.com/feed.html") }.show() }
    private fun search() { val input = EditText(this).apply { hint = "Search Your Mix"; setText(query) }; AlertDialog.Builder(this).setTitle("Search").setView(input).setPositiveButton("Search") { _, _ -> query = input.text.toString(); tab = "Home"; showApp() }.setNeutralButton("Clear") { _, _ -> query = ""; tab = "Home"; showApp() }.setNegativeButton("Cancel", null).show() }
    private fun refresh() {
        if (demo) { showApp(); return }
        work("Loading Your Mix…", { if (!api.sessionValid()) throw SessionExpired(); api.posts() }, { posts = it; showApp(); loadExtras() })
    }
    private fun loadExtras() {
        val current = epoch
        executor.execute {
            val loaded = runCatching { api.stories() }
            val activity = posts.associate { it.id to runCatching { api.engagement(it.id) }.getOrNull() }
            runOnUiThread { if (current == epoch && signedIn()) { loaded.onSuccess { flashes = it.first; roll = it.second }; activity.forEach { (id, value) -> if (value != null) engagement[id] = value }; if (tab == "Home") showApp() } }
        }
    }
    private fun startLogin() {
        demo = false; epoch++
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = bytes.joinToString("") { "%02x".format(it) }
        val challenge = MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()).joinToString("") { "%02x".format(it) }
        store.put("verifier", verifier)
        val url = "https://api.danzstak.com/auth/mobile-login?platform=android&challenge=$challenge"
        openWeb(url)
    }
    private fun handleDeepLink(intent: Intent?): Boolean {
        val uri = intent?.data ?: return false
        if (uri.scheme != "danzstak" || uri.host != "android" || uri.path != "/auth") return false
        val code = uri.getQueryParameter("code") ?: return false
        if (!code.matches(Regex("[a-f0-9]{64}"))) return false
        val verifier = store.get("verifier") ?: run { status.text = "Start login on this device first."; return true }
        intent.data = null
        work("Finishing secure login…", { api.exchange(code, verifier) }, { token -> store.put("session", token); store.remove("verifier"); demo = false; refresh() })
        return true
    }
    private fun signOut() {
        val token = store.get("session"); val wasDemo = demo
        epoch++; messageAlerts.reset(); demo = false; store.clear(); posts = emptyList(); flashes = emptyList(); roll = emptyList(); engagement.clear(); localMedia.clear(); chatMessages.clear(); locallyDeletedMessages.clear(); selectedChat = null; composerTags = emptyList(); composerLocation = ""; tab = "Home"; showApp()
        if (!wasDemo && token != null) executor.execute { runCatching { DanzStakApi { token }.logout() } }
    }
    private fun enterDemo() {
        epoch++; demo = true
        posts = listOf(
            FeedPost("demo-1", "DanzStak Community", "A place for the people who move music forward.\n\nShare your next set, find your scene, and make something worth showing up for.", "Today"),
            FeedPost("demo-2", "The Night Shift", "What’s the one track you always come back to? Drop it in the comments. 🎧", "Today"),
            FeedPost("demo-3", "You", "Ready to find my people. See you on the dance floor. ✨", "Today", owner = true),
            FeedPost("demo-4", "Studio Notes", "A little practice, a fresh idea, and a track that won’t leave your head. What are you working on today?", "Today"),
            FeedPost("demo-5", "Local Scenes", "Support the people building something in your city.", "Today"))
        flashes = listOf(MediaPage("demo-s1", "DanzStak", "Find your people. Feel your scene."), MediaPage("demo-s2", "The Night Shift", "One more track. One more moment."), MediaPage("demo-s3", "Local Scenes", "Your next great night starts here."))
        roll = listOf(MediaPage("demo-r1", "DanzStak", "In the mix"), MediaPage("demo-r2", "Studio Notes", "Behind the sound"))
        tab = "Home"; showApp()
    }
    private fun <T> work(message: String, job: () -> T, done: (T) -> Unit, failure: () -> Unit = {}) {
        status.text = message; val current = epoch
        executor.execute {
            if (current != epoch) return@execute
            try { val result = job(); runOnUiThread { if (!isDestroyed && current == epoch) { status.text = if (demo) "Preview · Changes stay on this device" else ""; done(result) } } }
            catch (error: Exception) { runOnUiThread { if (!isDestroyed && current == epoch) { failure(); if (error is SessionExpired) { epoch++; store.clear(); demo = false; posts = emptyList(); engagement.clear(); showApp() }; status.text = if (message == "Sending message…") "Message delivery was not confirmed. Your draft is saved. Reopen this conversation to check for delivery before sending again." else error.message ?: "Something went wrong. Try again." } } }
        }
    }
    private fun loadVideoFrame(url: String, image: ImageView) {
        if (!url.startsWith("https://")) return
        imageExecutor.execute {
            val retriever = android.media.MediaMetadataRetriever()
            val frame = try {
                retriever.setDataSource(url, emptyMap<String, String>())
                if (Build.VERSION.SDK_INT >= 27) retriever.getScaledFrameAtTime(0, android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 1024, 1024)
                else retriever.getFrameAtTime(0, android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            } catch (_: Exception) { null } finally { runCatching { retriever.release() } }
            runOnUiThread { if (!isDestroyed) { if (frame != null) image.setImageBitmap(frame); image.contentDescription = "Video preview. Tap to play." } }
        }
    }
    private fun loadImage(url: String, image: ImageView) {
        imageExecutor.execute {
            val bitmap = runCatching {
                val connection = java.net.URL(url).openConnection() as java.net.HttpURLConnection
                try { connection.instanceFollowRedirects = false; connection.connectTimeout = 10000; connection.readTimeout = 15000; require(connection.responseCode == 200); val bytes = connection.inputStream.use { stream -> val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192); var total = 0; while (true) { val count = stream.read(buffer); if (count < 0) break; total += count; require(total <= 8 * 1024 * 1024); out.write(buffer, 0, count) }; out.toByteArray() }; val options = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }; android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options); options.inSampleSize = maxOf(1, maxOf(options.outWidth, options.outHeight) / 1200); options.inJustDecodeBounds = false; android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) } finally { connection.disconnect() }
            }.getOrNull()
            runOnUiThread { if (!isDestroyed && bitmap != null) image.setImageBitmap(bitmap) }
        }
    }
    private fun openWeb(url: String) { if (!url.startsWith("https://")) return; runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }.onFailure { status.text = "Install a browser to open this link." } }
    private fun share(text: String) { video?.pause(); startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_TEXT, text) }, "Share")) }
    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun row() = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
    private fun title(text: String) { content.addView(label(text, 24, true)) }
    private fun label(text: String, size: Int, bold: Boolean = false) = TextView(this).apply { this.text = text; textSize = size.toFloat(); setTextColor(if (chatDark) Color.rgb(233, 237, 239) else ink); setPadding(dp(12), dp(8), dp(12), dp(8)); if (bold) setTypeface(typeface, Typeface.BOLD) }
    private fun button(text: String, click: () -> Unit) = Button(this).apply { this.text = text; isAllCaps = false; setBackgroundColor(Color.TRANSPARENT); setTextColor(orange); minHeight = dp(44); setOnClickListener { click() } }
    private fun headerIcon(resource: Int, description: String, click: () -> Unit) = ImageButton(this).apply { setImageResource(resource); setColorFilter(Color.WHITE); setBackgroundColor(Color.TRANSPARENT); contentDescription = description; layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)); setPadding(dp(11), dp(11), dp(11), dp(11)); setOnClickListener { click() } }
    private fun icon(text: String, description: String, click: () -> Unit) = label(text, 24).apply { contentDescription = description; gravity = Gravity.CENTER; layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)); setOnClickListener { click() } }
    private inner class CountAction(resource: Int, count: Int) : LinearLayout(this@MainActivity) {
        private val image = ImageView(context)
        private val number = TextView(context)
        init {
            orientation = HORIZONTAL; gravity = Gravity.CENTER; minimumHeight = dp(48)
            image.setImageResource(resource); addView(image, LayoutParams(dp(23), dp(23)))
            number.text = count.toString(); number.textSize = 13f; number.setTypeface(number.typeface, Typeface.BOLD); number.setPadding(dp(7), 0, 0, 0)
            addView(number, LayoutParams(-2, -2)); setTextColor(orange)
        }
        fun setTextColor(color: Int) { image.setColorFilter(color); number.setTextColor(color) }
    }
    private fun action(glyph: String, description: String, count: Int, click: () -> Unit, long: () -> Unit): CountAction {
        val resource = when (description.lowercase()) { "like", "likes" -> R.drawable.like; "comment", "comments" -> R.drawable.comment; else -> R.drawable.share }
        return CountAction(resource, count).apply { contentDescription = "$description, $count"; setOnClickListener { click() }; setOnLongClickListener { long(); true } }
    }
    private fun card() = column().apply { background = rounded(if (chatDark) Color.rgb(32, 44, 51) else Color.WHITE); setPadding(dp(8), dp(8), dp(8), dp(8)); layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(12), dp(6), dp(12), dp(6)) } }
    private fun rounded(color: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(16).toFloat() }
    private fun avatar(name: String, picture: String): View {
        if (picture.startsWith("https://")) return ImageView(this).apply { layoutParams = LinearLayout.LayoutParams(dp(44), dp(44)); scaleType = ImageView.ScaleType.CENTER_CROP; contentDescription = name; loadImage(picture, this) }
        return label(name.split(" ").take(2).joinToString("") { it.take(1) }, 14, true).apply { gravity = Gravity.CENTER; setPadding(0, 0, 0, 0); setTextColor(Color.WHITE); background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(orange, Color.rgb(170, 60, 225))).apply { shape = GradientDrawable.OVAL }; layoutParams = LinearLayout.LayoutParams(dp(42), dp(42)) }
    }
    private fun watcher(change: (String) -> Unit) = object : TextWatcher { override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {} ; override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { change(s.toString()) }; override fun afterTextChanged(s: Editable?) {} }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
