package akylas.alpi.maps.transit

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.os.Build
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import java.util.Date

/** One ongoing notification per followed train, so it shows on the lock screen. Needs no widget. */
internal object TrainNotifier {
    private const val CHANNEL_ID = "train_follow"
    private const val TAG = "train_follow"

    private fun channel(context: Context, manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(CHANNEL_ID, context.getString(R.string.tf_channel_name), NotificationManager.IMPORTANCE_DEFAULT)
            // silent, but not "low": Android hides the low ones from the lock screen
            channel.setSound(null, null)
            channel.enableVibration(false)
            channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            channel.setShowBadge(false)
            manager.createNotificationChannel(channel)
        }
    }

    private fun action(context: Context, icon: Int, label: Int, intent: PendingIntent) =
        Notification.Action.Builder(Icon.createWithResource(context, icon), context.getString(label), intent).build()

    @Suppress("DEPRECATION")
    private fun builder(context: Context) = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL_ID) else Notification.Builder(context)

    private fun build(context: Context, row: TrainRow, now: Long): Notification {
        val timeFormat = DateFormat.getTimeFormat(context)
        val palette = Palette(context)
        val (textColor, _) = row.statusColors(now)
        val label = listOfNotNull(row.trainName, row.trainNumber).joinToString(" ")
        val summary = listOf(
            if (row.isCancelled()) null else timeFormat.format(Date(row.timeMillis)),
            row.statusLabel(context, now),
            row.track?.let { context.getString(R.string.tf_track, it) }
        ).filterNotNull().joinToString(" · ")

        val collapsed = RemoteViews(context.packageName, R.layout.train_notification)
        bindTrainRow(context, collapsed, row, now, palette, timeFormat)
        // the collapsed height is short: the delay chip says it already
        collapsed.setViewVisibility(R.id.tf_scheduled, View.GONE)
        val expanded = RemoteViews(context.packageName, R.layout.train_notification_big)
        bindTrainRow(context, expanded, row, now, palette, timeFormat)
        val openApp = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val openAppIntent = PendingIntent.getActivity(context, 0, openApp, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        bindTrainChange(expanded, row, palette, openAppIntent)
        val progress = row.progressPercent(now)
        if (progress == null) {
            expanded.setViewVisibility(R.id.tf_progress_block, View.GONE)
        } else {
            expanded.setProgressBar(R.id.tf_progress, 100, progress, false)
            expanded.setTextViewText(R.id.tf_progress_start, row.legFrom ?: row.origin ?: "")
            expanded.setTextViewText(R.id.tf_progress_end, row.legTo ?: row.stopName)
        }

        val builder = builder(context)
            .setSmallIcon(R.drawable.tf_ic_train)
            .setContentTitle(if (row.isItinerary) "$label · ${row.stopName}" else context.getString(R.string.tf_notification_title, label, row.stopName))
            .setContentText(summary)
            .setColor(context.getColor(textColor))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(openAppIntent)
            .addAction(action(context, R.drawable.tf_ic_refresh, R.string.tf_refresh, TrainFollowScheduler.pendingIntent(context, TrainFollowScheduler.ACTION_REFRESH)))
            .addAction(action(context, R.drawable.tf_ic_close, R.string.tf_remove, TrainFollowActionReceiver.removeIntent(context, row.id)))
        if (Build.VERSION.SDK_INT >= 24) {
            // the system keeps its header and actions around the colored row
            builder.setStyle(Notification.DecoratedCustomViewStyle()).setCustomContentView(collapsed).setCustomBigContentView(expanded)
        } else {
            builder.setStyle(Notification.BigTextStyle().bigText(summary))
        }
        return builder.build()
    }

    @JvmStatic
    fun update(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val now = System.currentTimeMillis()
        val rows = TrainFollowStore.readRows(context).filter { now < it.expiresAtMillis }
        channel(context, manager)
        val ids = rows.map { it.id.hashCode() }.toSet()
        manager.activeNotifications.filter { it.tag == TAG && it.id !in ids }.forEach { manager.cancel(TAG, it.id) }
        rows.forEach { manager.notify(TAG, it.id.hashCode(), build(context, it, now)) }
    }
}
