package com.danzstak.app

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import org.json.JSONObject

/** Foreground delivery only. Closed-app delivery requires Firebase registration and server push. */
class MessageAlerts(private val activity: Activity) {
    private val manager = activity.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val seen = mutableMapOf<String, String>()
    private var baseline = false
    init {
        manager.createNotificationChannel(NotificationChannel("danzstak_messages", "Messages", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "DanzStak text messages"
            setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
        })
    }
    fun enable() {
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 40)
    }
    fun reset() { seen.clear(); baseline = false }
    fun update(chats: List<JSONObject>) {
        val allowed = Build.VERSION.SDK_INT < 33 || activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        for (chat in chats) {
            val id = chat.optString("contactEmail"); val stamp = chat.optString("updatedAt")
            if (chat.optBoolean("muted")) manager.cancel(id.hashCode())
            if (!chat.optBoolean("muted") && allowed && baseline && chat.optInt("unread") > 0 && seen[id] != stamp) {
                manager.notify(id.hashCode(), Notification.Builder(activity, "danzstak_messages").setSmallIcon(android.R.drawable.ic_dialog_email).setContentTitle("DanzStak · ${chat.optString("name", "New message")}").setContentText("New message").setAutoCancel(true).build())
            }
            seen[id] = stamp
        }
        baseline = true
    }
}
