package com.danzstak.app

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.InputFilter
import android.text.InputType
import android.view.View
import android.widget.*
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors

/** Native editor. Picks/removals are drafts until the user presses Save Changes. */
class ProfileEditorDialog(
    private val activity: Activity,
    private val api: DanzStakApi,
    private val demo: Boolean,
    private val demoProfile: JSONObject,
    private val pick: (String, (Uri) -> Unit) -> Unit,
    private val loadImage: (String, ImageView) -> Unit,
    private val prepareVideo: (File) -> File,
    private val playVideo: (String) -> Unit,
    private val onSaved: (JSONObject) -> Unit,
    private val onExpired: () -> Unit,
    private val onImport: () -> Unit
) {
    private data class DraftMedia(val file: File, val type: String, var key: String? = null)
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private val folder = File(activity.cacheDir, "profile-edit/${UUID.randomUUID()}").apply { mkdirs() }
    private val form = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(18), dp(8), dp(18), dp(18)) }
    private val fields = linkedMapOf<String, EditText>()
    private val feedback = text("Loading profile…")
    private val cover = ProfileCoverView(activity).apply { setBackgroundColor(Color.rgb(31, 61, 94)); contentDescription = "Cover photo preview" }
    private val photo = ImageView(activity).apply { scaleType = ImageView.ScaleType.CENTER_CROP; contentDescription = "Profile photo preview"; setImageResource(R.drawable.profile) }
    private val coverControls = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; visibility = View.GONE }
    private val coverFit = Switch(activity).apply { text = "Fit entire cover" }
    private val coverX = SeekBar(activity).apply { max = 100; progress = 50; contentDescription = "Horizontal cover position" }
    private val coverY = SeekBar(activity).apply { max = 100; progress = 50; contentDescription = "Vertical cover position" }
    private val tags = Switch(activity).apply { text = "Allow people to tag me" }
    private val permissions = Spinner(activity)
    private val language = Spinner(activity)
    private val pending = mutableMapOf<String, DraftMedia>()
    private val remove = mutableSetOf<String>()
    private var loaded = false
    private var busy = false
    private var closed = false
    private var committed: JSONObject? = null
    private var profile = JSONObject()
    private var settings = JSONObject()
    private var video = JSONObject()
    private var videoReady = false
    private lateinit var dialog: AlertDialog
    private lateinit var retry: Button
    private lateinit var removePhoto: Button
    private lateinit var removeCover: Button
    private lateinit var changeVideo: Button
    private lateinit var removeVideo: Button
    private lateinit var watchVideo: Button
    private val languages = listOf("en" to "English", "es" to "Español", "fr" to "Français", "de" to "Deutsch", "pt" to "Português", "it" to "Italiano", "ko" to "한국어", "ja" to "日本語", "zh-Hans" to "简体中文", "zh-Hant" to "繁體中文", "fil" to "Filipino / Tagalog", "hi" to "हिन्दी", "vi" to "Tiếng Việt", "th" to "ไทย", "id" to "Bahasa Indonesia")
    private val posting = listOf("owner" to "Only me", "friends" to "Friends", "anyone" to "Anyone on DanzStak")

    fun show() {
        section("Profile photo")
        form.addView(photo, LinearLayout.LayoutParams(dp(96), dp(96)))
        button("Change Profile Photo") { choose("avatar") }
        removePhoto = button("Remove Profile Photo") { confirmRemove("avatar", "profile photo") }
        section("Cover photo")
        form.addView(cover, LinearLayout.LayoutParams(-1, dp(180)))
        button("Change Cover Photo") { choose("cover") }
        removeCover = button("Remove Cover Photo") { confirmRemove("cover", "cover photo") }
        button("Reposition Cover") { coverControls.visibility = if (coverControls.visibility == View.VISIBLE) View.GONE else View.VISIBLE }
        coverControls.addView(text("Horizontal position")); coverControls.addView(coverX)
        coverControls.addView(text("Vertical position")); coverControls.addView(coverY)
        form.addView(coverControls); form.addView(coverFit)
        listOf(coverX, coverY).forEach { bar -> bar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(view: SeekBar?, progress: Int, user: Boolean) { cover.coverX = coverX.progress.toFloat(); cover.coverY = coverY.progress.toFloat() }
            override fun onStartTrackingTouch(view: SeekBar?) {}
            override fun onStopTrackingTouch(view: SeekBar?) {}
        }) }
        coverFit.setOnCheckedChangeListener { _, checked -> cover.fitEntire = checked }
        section("Profile video")
        changeVideo = button("Add or change Profile Video") { choose("video") }
        removeVideo = button("Remove Profile Video") { confirmRemove("video", "profile video") }
        watchVideo = button("Play Profile Video") { val url = pending["video"]?.file?.let { Uri.fromFile(it).toString() } ?: video.optString("mediaUrl"); if (url.isNotBlank()) playVideo(url) }
        section("About you")
        field("name", "Display name", 80)
        field("handle", "Username", 24)
        field("bio", "Bio", 160, true)
        field("location", "Location", 80)
        field("work", "Work", 100)
        field("website", "Website", 200).apply { inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI; hint = "https://" }
        form.addView(text("DanzStak language"))
        language.adapter = ArrayAdapter(activity, android.R.layout.simple_spinner_dropdown_item, languages.map { it.second }); language.contentDescription = "DanzStak language"; form.addView(language)
        form.addView(text("Account preference; native menus currently use English."))
        form.addView(text("Who can post on your profile?"))
        permissions.adapter = ArrayAdapter(activity, android.R.layout.simple_spinner_dropdown_item, posting.map { it.second }); permissions.contentDescription = "Who can post on your profile?"; form.addView(permissions)
        form.addView(tags); form.addView(text("Tagging applies to accepted friends. Share only information you want members to see."))
        form.addView(text("Display names and usernames must each be unique. A name conflict will appear here without closing your draft."))
        form.addView(feedback)
        retry = button("Retry loading profile") { load() }
        button("Import from Facebook") { onImport() }
        dialog = AlertDialog.Builder(activity).setTitle("Edit Profile").setView(ScrollView(activity).apply { addView(form) }).setNegativeButton("Cancel", null).setPositiveButton("Save Changes", null).create()
        dialog.setOnDismissListener { val notify = !closed && !activity.isDestroyed; closed = true; worker.shutdown(); folder.deleteRecursively(); if (notify) committed?.let(onSaved) }
        dialog.setOnShowListener { dialog.getButton(-1).apply { isAllCaps = false; contentDescription = "Save profile changes"; setOnClickListener { save() } }; dialog.getButton(-2).isAllCaps = false; load() }
        dialog.show(); dialog.window?.setLayout(-1, -1)
    }
    fun dismiss() { closed = true; if (::dialog.isInitialized) dialog.dismiss() }
    private fun controls() {
        fun enable(view: View) { view.isEnabled = loaded && !busy; if (view is android.view.ViewGroup) for (i in 0 until view.childCount) enable(view.getChildAt(i)) }
        enable(form); feedback.isEnabled = true
        retry.visibility = if (!loaded && !busy) View.VISIBLE else View.GONE; retry.isEnabled = !busy
        dialog.getButton(-1).isEnabled = loaded && !busy; dialog.getButton(-2).isEnabled = !busy; dialog.setCancelable(!busy)
        changeVideo.isEnabled = loaded && videoReady && !busy
        removePhoto.isEnabled = loaded && !busy && "avatar" !in remove && (pending.containsKey("avatar") || profile.optString("picture").isNotBlank())
        removeCover.isEnabled = loaded && !busy && "cover" !in remove && (pending.containsKey("cover") || profile.optString("cover").isNotBlank())
        removeVideo.isEnabled = loaded && videoReady && !busy && "video" !in remove && (pending.containsKey("video") || video.optString("mediaKey").isNotBlank())
        watchVideo.isEnabled = loaded && videoReady && !busy && "video" !in remove && (pending.containsKey("video") || video.optString("mediaUrl").isNotBlank())
    }
    private fun load() {
        busy = true; feedback.text = "Loading profile…"; controls()
        worker.execute {
            try {
                val loadedProfile = if (demo) JSONObject(demoProfile.toString()) else api.profile()
                val loadedSettings = if (demo) JSONObject().put("language", demoProfile.optString("language", "en")).put("allowTags", demoProfile.optBoolean("allowTags", true)) else api.settings()
                val profileVideo = if (demo) JSONObject().put("mediaKey", demoProfile.optString("videoUrl")).put("mediaUrl", demoProfile.optString("videoUrl")) else try { api.profileVideo() } catch (error: SessionExpired) { throw error } catch (_: Exception) { null }
                ui {
                    profile = loadedProfile; settings = loadedSettings; video = profileVideo ?: JSONObject(); videoReady = profileVideo != null
                    fields.forEach { (key, view) -> view.setText(profile.optString(key)) }
                    coverX.progress = profile.optInt("coverX", 50); coverY.progress = profile.optInt("coverY", 50); coverFit.isChecked = profile.optBoolean("coverFit")
                    tags.isChecked = profile.optBoolean("allowTags", settings.optBoolean("allowTags", true))
                    permissions.setSelection(posting.indexOfFirst { it.first == profile.optString("profilePostPermission", "owner") }.coerceAtLeast(0))
                    language.setSelection(languages.indexOfFirst { it.first == settings.optString("language", "en") }.coerceAtLeast(0))
                    preview(profile.optString("picture"), photo); preview(profile.optString("cover"), cover)
                    loaded = true; busy = false
                    feedback.text = if (!videoReady) "Profile loaded, but video could not load. Close and reopen Edit Profile to retry video controls." else if (demo) "Preview · Changes stay on this device" else "Changes are applied only when you save."
                    controls()
                }
            } catch (error: Exception) { ui { if (error is SessionExpired) { dismiss(); onExpired() } else { busy = false; feedback.text = error.message ?: "Profile could not load. Try again."; controls() } } }
        }
    }
    private fun choose(kind: String) {
        AlertDialog.Builder(activity).setTitle(if (kind == "video") "Original video" else "Original photo").setMessage(if (kind == "video") "Confirm that you created this video and that any music is your original material." else "Confirm that you created this image and it contains no third-party copyrighted material.").setNegativeButton("Cancel", null).setPositiveButton("I confirm") { _, _ ->
            pick(kind) { uri -> selected(kind, uri) }
        }.show()
    }
    private fun selected(kind: String, uri: Uri) {
        if (closed || busy) return
        val type = activity.contentResolver.getType(uri).orEmpty().lowercase()
        val allowed = if (kind == "video") setOf("video/mp4", "video/webm", "video/quicktime") else setOf("image/jpeg", "image/png", "image/webp")
        if (type !in allowed) { feedback.text = if (kind == "video") "Choose MP4, WebM, or MOV." else "Choose JPG, PNG, or WebP."; return }
        busy = true; feedback.text = "Preparing selected media…"; controls()
        worker.execute {
            try {
                val original = File(folder, UUID.randomUUID().toString())
                activity.contentResolver.openInputStream(uri)?.use { input -> original.outputStream().use { output -> val buffer = ByteArray(64 * 1024); var total = 0L; while (true) { val count = input.read(buffer); if (count < 0) break; total += count; require(total <= 100L * 1024 * 1024) { "Choose media smaller than 100 MB." }; output.write(buffer, 0, count) } } } ?: error("The selected media could not be read.")
                require(original.length() > 0) { "The selected file is empty." }
                val bitmap = if (kind == "video") null else decode(original, if (kind == "avatar") 720 else 1800)
                val media = if (bitmap != null) {
                    val transparent = bitmap.hasAlpha(); val file = File(folder, UUID.randomUUID().toString() + if (transparent) ".png" else ".jpg")
                    file.outputStream().use { bitmap.compress(if (transparent) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.JPEG, 90, it) }; original.delete()
                    DraftMedia(file, if (transparent) "image/png" else "image/jpeg")
                } else DraftMedia(original, type)
                ui { pending.put(kind, media)?.file?.delete(); remove.remove(kind); if (bitmap != null) (if (kind == "avatar") photo else cover).apply { tag = "draft-${UUID.randomUUID()}"; setImageBitmap(bitmap) }; busy = false; feedback.text = "${if (kind == "video") "Video" else "Photo"} selected · Save Changes to apply"; controls() }
            } catch (error: Exception) { ui { busy = false; feedback.text = error.message ?: "Media could not be prepared."; controls() } }
        }
    }
    private fun confirmRemove(kind: String, label: String) {
        AlertDialog.Builder(activity).setTitle("Remove $label?").setMessage("This will be removed when you save changes.").setNegativeButton("Cancel", null).setPositiveButton("Remove") { _, _ ->
            pending.remove(kind)?.file?.delete(); remove.add(kind)
            if (kind == "avatar") { photo.tag = "removed"; photo.setImageResource(R.drawable.profile) } else if (kind == "cover") { cover.tag = "removed"; cover.setImageDrawable(null) }
            feedback.text = "Removal selected · Save Changes to apply"; controls()
        }.show()
    }
    private fun save() {
        if (!loaded || busy) return
        val changes = JSONObject()
        fields.forEach { (key, view) -> changes.put(key, view.text.toString().trim().let { if (key == "handle") it.removePrefix("@") else it }) }
        if (changes.getString("name").length < 2) { fields.getValue("name").error = "Use at least 2 characters"; fields.getValue("name").requestFocus(); return }
        if (!changes.getString("handle").matches(Regex("[A-Za-z0-9._]{3,24}"))) { fields.getValue("handle").error = "Use 3–24 letters, numbers, dots, or underscores"; fields.getValue("handle").requestFocus(); return }
        val website = changes.getString("website")
        if (website.isNotBlank() && (Uri.parse(website).scheme != "https" || Uri.parse(website).host.isNullOrBlank() || website.any { it.isWhitespace() })) { fields.getValue("website").error = "Use an HTTPS website address"; fields.getValue("website").requestFocus(); return }
        changes.put("coverX", coverX.progress).put("coverY", coverY.progress).put("coverFit", coverFit.isChecked).put("profilePostPermission", posting[permissions.selectedItemPosition].first).put("allowTags", tags.isChecked)
        val chosenLanguage = languages[language.selectedItemPosition].first
        busy = true; feedback.text = "Saving profile…"; controls()
        worker.execute {
            var profileCommitted = false
            try {
                listOf("avatar", "cover").forEach { kind ->
                    if (kind in remove) changes.put(kind + "Key", "")
                    pending[kind]?.let { media ->
                        if (!demo && media.key == null) media.key = api.uploadProfileMedia(media.file, media.type).getString("mediaKey")
                        if (!demo) changes.put(kind + "Key", media.key)
                    }
                }
                val saved = if (demo) JSONObject(profile.toString()).apply {
                    changes.keys().forEach { key -> put(key, changes.get(key)) }
                    for ((kind, media) in pending) if (kind != "video") put(if (kind == "avatar") "picture" else "cover", demoCopy(media.file))
                    if ("avatar" in remove) put("picture", ""); if ("cover" in remove) put("cover", "")
                } else api.saveProfile(changes)
                profileCommitted = true; committed = saved
                pending["video"]?.let { media ->
                    if (demo) saved.put("videoUrl", demoCopy(media.file))
                    else {
                        if (media.key == null) { ui { feedback.text = "Preparing profile video…" }; val output = prepareVideo(media.file); try { media.key = api.uploadProfileMedia(output, "video/mp4").getString("mediaKey") } finally { if (output != media.file) output.delete() } }
                        api.saveProfileVideo(requireNotNull(media.key))
                    }
                }
                if ("video" in remove) { if (demo) saved.put("videoUrl", "") else api.saveProfileVideo("") }
                if (!demo && (chosenLanguage != settings.optString("language", "en") || changes.getBoolean("allowTags") != settings.optBoolean("allowTags", true))) {
                    val latestSettings = api.settings()
                    if (chosenLanguage != settings.optString("language", "en")) latestSettings.put("language", chosenLanguage)
                    api.saveTagConsent(latestSettings, changes.getBoolean("allowTags"))
                }
                saved.put("language", chosenLanguage)
                ui { busy = false; dialog.dismiss() }
            } catch (error: Exception) {
                ui { if (error is SessionExpired) { dismiss(); onExpired() } else { busy = false; feedback.text = (if (profileCommitted) "Profile details were saved. Some remaining changes were not confirmed. " else "") + (error.message ?: "Save could not be confirmed. Your draft is preserved."); controls() } }
            }
        }
    }
    private fun demoCopy(file: File): String { val target = File(activity.cacheDir, "profile-demo/${UUID.randomUUID()}"); target.parentFile?.mkdirs(); file.copyTo(target); return Uri.fromFile(target).toString() }
    private fun decode(file: File, maximum: Int): Bitmap {
        if (Build.VERSION.SDK_INT >= 28) return android.graphics.ImageDecoder.decodeBitmap(android.graphics.ImageDecoder.createSource(file)) { decoder, info, _ -> val scale = minOf(1f, maximum.toFloat() / maxOf(info.size.width, info.size.height)); decoder.setTargetSize(maxOf(1, (info.size.width * scale).toInt()), maxOf(1, (info.size.height * scale).toInt())); decoder.allocator = android.graphics.ImageDecoder.ALLOCATOR_SOFTWARE }
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }; BitmapFactory.decodeFile(file.path, options)
        options.inSampleSize = 1; while (maxOf(options.outWidth, options.outHeight) / options.inSampleSize > maximum) options.inSampleSize *= 2; options.inJustDecodeBounds = false
        var result = BitmapFactory.decodeFile(file.path, options) ?: error("The selected image could not be decoded.")
        val orientation = runCatching { android.media.ExifInterface(file.path).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, android.media.ExifInterface.ORIENTATION_NORMAL) }.getOrDefault(android.media.ExifInterface.ORIENTATION_NORMAL)
        val transform = android.graphics.Matrix().apply { when (orientation) { 2 -> setScale(-1f, 1f); 3 -> setRotate(180f); 4 -> setScale(1f, -1f); 5 -> { setRotate(90f); postScale(-1f, 1f) }; 6 -> setRotate(90f); 7 -> { setRotate(270f); postScale(-1f, 1f) }; 8 -> setRotate(270f) } }
        if (!transform.isIdentity) result = Bitmap.createBitmap(result, 0, 0, result.width, result.height, transform, true)
        return result
    }
    private fun preview(url: String, image: ImageView) {
        if (url.startsWith("https://")) loadImage(url, image)
        else if (demo && url.startsWith(Uri.fromFile(File(activity.cacheDir, "profile-demo")).toString())) image.setImageURI(Uri.parse(url))
    }
    private fun ui(action: () -> Unit) { main.post { if (!closed && !activity.isDestroyed) action() } }
    private fun section(value: String) { form.addView(text(value).apply { textSize = 19f; setTypeface(null, android.graphics.Typeface.BOLD) }) }
    private fun text(value: String) = TextView(activity).apply { text = value; textSize = 14f; setTextColor(Color.rgb(29, 34, 43)); setPadding(0, dp(8), 0, dp(8)) }
    private fun button(value: String, action: () -> Unit): Button = Button(activity).apply { text = value; isAllCaps = false; setTextColor(Color.rgb(44, 82, 255)); setOnClickListener { action() }; form.addView(this) }
    private fun field(key: String, title: String, maximum: Int, multiline: Boolean = false): EditText { form.addView(text(title)); return EditText(activity).apply { contentDescription = title; hint = title; filters = arrayOf(InputFilter.LengthFilter(maximum)); inputType = InputType.TYPE_CLASS_TEXT or if (multiline) InputType.TYPE_TEXT_FLAG_MULTI_LINE else InputType.TYPE_TEXT_VARIATION_NORMAL; if (multiline) minLines = 3; form.addView(this); fields[key] = this } }
    private fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
}
