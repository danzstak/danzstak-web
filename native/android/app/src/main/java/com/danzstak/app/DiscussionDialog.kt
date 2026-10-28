package com.danzstak.app

import android.app.Activity
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

/** A native discussion, with a separate composer for root comments or an explicit parent. */
class DiscussionDialog(
    private val activity: Activity,
    private val api: DanzStakApi,
    private val post: FeedPost,
    initial: JSONObject,
    private val demo: Boolean,
    private val initialParent: String?,
    private val avatar: (String, String) -> View,
    private val linkedText: (String, Int) -> TextView,
    private val onChanged: (JSONObject) -> Unit,
    private val onVisible: () -> Unit,
    private val onDismiss: () -> Unit,
    private val onExpired: () -> Unit
) {
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val dialog = Dialog(activity, android.R.style.Theme_DeviceDefault_Light_NoActionBar)
    private val root = column().apply { setBackgroundColor(Color.rgb(246, 247, 250)) }
    private val list = column()
    private val scroll = ScrollView(activity).apply { isFillViewport = true; addView(list) }
    private val status = label("", 13).apply { visibility = View.GONE }
    private val replyRow = LinearLayout(activity).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding(dp(12), dp(6), dp(8), dp(6)); setBackgroundColor(Color.rgb(230, 238, 255)); visibility = View.GONE }
    private val replying = label("", 13)
    private val input = EditText(activity).apply { hint = "Write a comment…"; contentDescription = "Comment text"; minLines = 1; maxLines = 5; filters = arrayOf(InputFilter.LengthFilter(1000)); background = rounded(Color.WHITE); setPadding(dp(12), dp(10), dp(12), dp(10)) }
    private val send = ImageButton(activity).apply { setImageResource(android.R.drawable.ic_menu_send); setColorFilter(Color.rgb(44, 82, 255)); contentDescription = "Send comment"; setBackgroundColor(Color.TRANSPARENT) }
    private var state = JSONObject(initial.toString())
    private var parentId: String? = initialParent
    private var busy = false
    private var closed = false
    private val comments get() = DanzStakApi.objects(state.optJSONArray("comments"))
    private val repliesSupported get() = demo || state.optBoolean("commentRepliesSupported", false)

    fun show() {
        val header = LinearLayout(activity).apply { gravity = Gravity.CENTER_VERTICAL; setPadding(dp(6), dp(4), dp(6), dp(4)); setBackgroundColor(Color.WHITE) }
        header.addView(label("Comments", 20, true), LinearLayout.LayoutParams(0, dp(52), 1f))
        header.addView(ImageButton(activity).apply { setImageResource(android.R.drawable.ic_menu_close_clear_cancel); contentDescription = "Close comments"; setBackgroundColor(Color.TRANSPARENT); setOnClickListener { if (!busy) dialog.dismiss() } }, LinearLayout.LayoutParams(dp(48), dp(48)))
        root.addView(header)
        root.addView(label(post.text, 14).apply { maxLines = 3; ellipsize = android.text.TextUtils.TruncateAt.END; setTextColor(Color.DKGRAY) })
        status.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { status.visibility = if (s.isNullOrBlank()) View.GONE else View.VISIBLE }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
        root.addView(status)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        replyRow.addView(replying, LinearLayout.LayoutParams(0, -2, 1f))
        replyRow.addView(ImageButton(activity).apply { setImageResource(android.R.drawable.ic_menu_close_clear_cancel); contentDescription = "Cancel reply"; setBackgroundColor(Color.TRANSPARENT); setOnClickListener { if (!busy) { parentId = null; status.text = ""; context() } } }, LinearLayout.LayoutParams(dp(40), dp(40)))
        root.addView(replyRow)
        val composer = LinearLayout(activity).apply { gravity = Gravity.BOTTOM; setPadding(dp(12), dp(8), dp(8), dp(8)); setBackgroundColor(Color.WHITE) }
        composer.addView(input, LinearLayout.LayoutParams(0, -2, 1f)); composer.addView(send, LinearLayout.LayoutParams(dp(48), dp(48))); root.addView(composer)
        root.setOnApplyWindowInsetsListener { view, insets ->
            if (android.os.Build.VERSION.SDK_INT >= 30) { val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars()); val keyboard = insets.getInsets(android.view.WindowInsets.Type.ime()); view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom)) }
            insets
        }
        dialog.setContentView(root); dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        scroll.viewTreeObserver.addOnScrollChangedListener { onVisible() }
        root.viewTreeObserver.addOnGlobalLayoutListener { onVisible() }
        dialog.setOnDismissListener { val notify = !closed && !activity.isDestroyed; closed = true; worker.shutdown(); if (notify) onDismiss() }
        input.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) { context() }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })
        send.setOnClickListener { send() }
        dialog.show(); dialog.window?.setLayout(-1, -1)
        if (demo) { comments.forEach { if (it.optString("commentId").isBlank()) it.put("commentId", UUID.randomUUID().toString()) }; state.put("commentRepliesSupported", true) }
        render(); if (!demo) refresh()
    }
    fun dismiss() { closed = true; dialog.dismiss() }
    private fun refresh() {
        busy = true; status.text = "Loading comments…"; context()
        worker.execute {
            try { val fresh = api.engagement(post.id); ui { state = fresh; busy = false; status.text = ""; onChanged(state); render() } }
            catch (error: Exception) { fail(error, "Comments could not load. Your draft is preserved.") }
        }
    }
    private fun context() {
        val parent = comments.firstOrNull { it.optString("commentId") == parentId }
        replyRow.visibility = if (parentId == null) View.GONE else View.VISIBLE
        replying.text = "Replying to ${parent?.optString("authorName") ?: "this comment"}"
        input.hint = if (parentId == null) "Write a comment…" else "Write a reply…"
        send.contentDescription = if (parentId == null) "Send comment" else "Send reply"
        send.isEnabled = !busy && input.text.toString().isNotBlank() && (parentId == null || repliesSupported && parent != null)
        send.alpha = if (send.isEnabled) 1f else 0.4f
        input.isEnabled = !busy
        dialog.setCancelable(!busy)
        if (parentId != null && !busy) {
            if (parent == null) status.text = "That comment is no longer available. Cancel the reply to write a new comment."
            else if (!repliesSupported) status.text = "Replies are waiting for the discussion service update. New comments still work."
        }
    }
    private fun select(comment: JSONObject) {
        if (busy) return
        val id = comment.optString("commentId")
        if (id.isBlank()) { status.text = "This comment cannot be selected for a reply. Refresh comments."; return }
        parentId = id; status.text = ""; context()
        if (repliesSupported) { input.requestFocus(); (activity.getSystemService(Activity.INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(input, InputMethodManager.SHOW_IMPLICIT) }
    }
    private fun render(reveal: String? = null) {
        val y = scroll.scrollY; list.removeAllViews()
        val all = comments; val ids = all.map { it.optString("commentId") }.toSet(); val seen = mutableSetOf<String>()
        val children = all.groupBy { it.optString("parentCommentId") }
        fun visit(item: JSONObject, depth: Int) {
            val id = item.optString("commentId"); if (!seen.add(id)) return
            val row = LinearLayout(activity).apply { gravity = Gravity.TOP; tag = "comment:$id"; setPadding(dp(12 + minOf(depth, 3) * 16), dp(8), dp(8), dp(8)); setOnClickListener { select(item) } }
            row.addView(avatar(item.optString("authorName", "DanzStak member"), item.optString("authorPicture")), LinearLayout.LayoutParams(dp(if (depth == 0) 34 else 28), dp(if (depth == 0) 34 else 28)).apply { rightMargin = dp(8) })
            val copy = column(); val bubble = column().apply { background = rounded(Color.rgb(234, 236, 242)); setPadding(dp(10), dp(6), dp(10), dp(6)); setOnClickListener { select(item) } }
            bubble.addView(label(item.optString("authorName", "DanzStak member"), 14, true).apply { setPadding(0, 0, 0, dp(4)) })
            if (item.optString("parentCommentId").isNotBlank()) {
                val name = all.firstOrNull { it.optString("commentId") == item.optString("parentCommentId") }?.optString("authorName") ?: item.optString("replyToName", "this comment")
                bubble.addView(label("Replying to $name", 12).apply { setTextColor(Color.DKGRAY); setPadding(0, 0, 0, dp(4)) })
            }
            bubble.addView(linkedText(item.optString("content"), 15).apply { setPadding(0, 0, 0, 0); setOnClickListener { select(item) } })
            copy.addView(bubble)
            val actions = LinearLayout(activity).apply { gravity = Gravity.CENTER_VERTICAL }
            actions.addView(label(time(item.optString("createdAt")), 12).apply { setTextColor(Color.GRAY); setPadding(dp(8), dp(2), dp(8), dp(2)) }, LinearLayout.LayoutParams(0, -2, 1f))
            actions.addView(ImageButton(activity).apply { setImageResource(R.drawable.reply); contentDescription = "Reply to ${item.optString("authorName", "DanzStak member")}"; setColorFilter(Color.rgb(44, 82, 255)); setBackgroundColor(Color.TRANSPARENT); setOnClickListener { select(item) } }, LinearLayout.LayoutParams(dp(40), dp(36)))
            copy.addView(actions); row.addView(copy, LinearLayout.LayoutParams(0, -2, 1f)); list.addView(row)
            children[id].orEmpty().filter { it !== item }.forEach { visit(it, depth + 1) }
        }
        if (all.isEmpty()) list.addView(label("Be the first to comment.", 15))
        all.filter { it.optString("parentCommentId").isBlank() || it.optString("parentCommentId") !in ids || it.optString("parentCommentId") == it.optString("commentId") }.forEach { visit(it, if (it.optString("parentCommentId").isBlank()) 0 else 1) }
        all.filter { it.optString("commentId") !in seen }.forEach { visit(it, 0) }
        list.addView(Button(activity).apply { text = "Refresh comments"; isAllCaps = false; setOnClickListener { if (!busy && !demo) refresh() } })
        context()
        scroll.post { val target = reveal?.let { list.findViewWithTag<View>("comment:$it") }; scroll.scrollTo(0, target?.top?.minus(dp(12))?.coerceAtLeast(0) ?: y) }
    }
    private fun send() {
        val text = input.text.toString().trim(); if (text.isBlank() || busy) return
        val target = parentId; val parent = comments.firstOrNull { it.optString("commentId") == target }
        if (target != null && (!repliesSupported || parent == null)) { context(); return }
        busy = true; status.text = if (target == null) "Posting comment…" else "Posting reply…"; context()
        worker.execute {
            var accepted = false
            try {
                val comment = if (demo) JSONObject().put("commentId", UUID.randomUUID().toString()).put("authorName", "You").put("content", text).put("createdAt", java.time.Instant.now().toString()).apply { if (target != null) put("parentCommentId", target).put("replyToName", parent?.optString("authorName")) }
                    else api.comment(post.id, text, target)
                accepted = true
                val fresh = if (demo) null else try { api.engagement(post.id) } catch (error: SessionExpired) { throw error } catch (_: Exception) { null }
                val persisted = fresh?.let { DanzStakApi.objects(it.optJSONArray("comments")).firstOrNull { row -> row.optString("commentId") == comment.optString("commentId") } } ?: comment
                val mismatch = target != null && persisted.optString("parentCommentId") != target
                ui {
                    if (fresh != null) state = fresh else { val items = state.optJSONArray("comments") ?: JSONArray(); if (comment.optString("commentId").isNotBlank()) items.put(comment.apply { if (!has("authorName")) put("authorName", "You") }); state.put("comments", items) }
                    if (mismatch) state.put("commentRepliesSupported", false)
                    input.text.clear(); parentId = null; busy = false
                    status.text = if (mismatch) "The service did not confirm this as a reply. Check the discussion before posting again." else if (fresh == null && !demo) "Comment accepted. Refresh to confirm the latest discussion." else ""
                    onChanged(state); render(comment.optString("commentId"))
                }
            } catch (error: Exception) { fail(error, if (accepted) "Comment accepted, but the discussion could not refresh." else "Posting was not confirmed. Refresh comments before trying again; your draft is preserved.") }
        }
    }
    private fun fail(error: Exception, message: String) { ui { if (error is SessionExpired) { dismiss(); onExpired() } else { busy = false; status.text = message; context() } } }
    private fun ui(action: () -> Unit) { main.post { if (!closed && !activity.isDestroyed) action() } }
    private fun column() = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
    private fun label(value: String, size: Int, bold: Boolean = false) = TextView(activity).apply { text = value; textSize = size.toFloat(); setTextColor(Color.rgb(29, 34, 43)); setPadding(dp(12), dp(8), dp(12), dp(8)); if (bold) setTypeface(null, android.graphics.Typeface.BOLD) }
    private fun time(value: String): String = runCatching { val instant = java.time.Instant.parse(value); val seconds = java.time.Duration.between(instant, java.time.Instant.now()).seconds.coerceAtLeast(0); when { seconds < 60 -> "Just now"; seconds < 3600 -> "${seconds / 60}m"; seconds < 86400 -> "${seconds / 3600}h"; else -> java.time.format.DateTimeFormatter.ofLocalizedDate(java.time.format.FormatStyle.MEDIUM).withLocale(java.util.Locale.getDefault()).withZone(java.time.ZoneId.systemDefault()).format(instant) } }.getOrDefault("")
    private fun rounded(color: Int) = GradientDrawable().apply { setColor(color); cornerRadius = dp(14).toFloat() }
    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
}
