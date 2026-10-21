package akylas.alpi.maps.transit

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import android.view.View
import android.widget.RemoteViews
import java.util.Date

class TrainWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetManager.updateAppWidget(appWidgetIds, buildViews(context))
        // a widget just added shows fresh data
        if (TrainFollowStore.hasFollows(context)) {
            TrainFollowScheduler.requestRefresh(context, TrainFollowScheduler.ACTION_ALARM)
        }
    }

    companion object {
        @JvmStatic
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, TrainWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                manager.updateAppWidget(ids, buildViews(context))
            }
        }

        private fun openAppIntent(context: Context): PendingIntent {
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun buildViews(context: Context): RemoteViews {
            val now = System.currentTimeMillis()
            val rows = TrainFollowStore.readRows(context).filter { now < it.expiresAtMillis }
            val views = RemoteViews(context.packageName, R.layout.train_widget)
            if (rows.isEmpty()) {
                // nothing to show: no card, only a hint, so the widget nearly disappears
                views.setInt(R.id.tf_root, "setBackgroundResource", 0)
                views.setViewVisibility(R.id.tf_header, View.GONE)
                views.setViewVisibility(R.id.tf_list, View.GONE)
                views.setViewVisibility(R.id.tf_empty, View.VISIBLE)
                views.setOnClickPendingIntent(R.id.tf_root, openAppIntent(context))
                return views
            }
            val palette = Palette(context)
            val timeFormat = DateFormat.getTimeFormat(context)
            val lastFetch = rows.maxOf { it.fetchedAtMillis }
            views.setTextViewText(R.id.tf_updated, if (lastFetch > 0) timeFormat.format(Date(lastFetch)) else "")
            views.setOnClickPendingIntent(R.id.tf_refresh, TrainFollowScheduler.pendingIntent(context, TrainFollowScheduler.ACTION_REFRESH))
            views.removeAllViews(R.id.tf_list)
            val openApp = openAppIntent(context)
            rows.forEach { row -> views.addView(R.id.tf_list, buildRow(context, row, now, palette, timeFormat, openApp)) }
            return views
        }

        private fun buildRow(context: Context, row: TrainRow, now: Long, palette: Palette, timeFormat: java.text.DateFormat, openApp: PendingIntent): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.train_widget_row)
            bindTrainRow(context, views, row, now, palette, timeFormat)
            bindTrainChange(views, row, palette, openApp)
            views.setOnClickPendingIntent(R.id.tf_row, openApp)
            views.setOnClickPendingIntent(R.id.tf_remove, TrainFollowActionReceiver.removeIntent(context, row.id))
            return views
        }
    }
}
