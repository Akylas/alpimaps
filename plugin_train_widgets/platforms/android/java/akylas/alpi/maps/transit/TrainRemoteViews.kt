package akylas.alpi.maps.transit

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.os.Build
import android.os.SystemClock
import android.text.SpannableString
import android.text.Spanned
import android.text.style.StrikethroughSpan
import android.view.View
import android.widget.RemoteViews
import java.util.Date

/** Colors that follow the system theme even when the widget is not redrawn (Android 14+), else the theme at draw time. */
internal class Palette(private val context: Context) {
    private val day = context.withNight(false)
    private val night = context.withNight(true)

    private fun Context.withNight(night: Boolean): Context {
        val configuration = Configuration(resources.configuration)
        val nightMode = if (night) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
        configuration.uiMode = (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or nightMode
        return createConfigurationContext(configuration)
    }

    fun textColor(views: RemoteViews, viewId: Int, colorRes: Int) {
        if (Build.VERSION.SDK_INT >= 34) {
            views.setColorInt(viewId, "setTextColor", day.getColor(colorRes), night.getColor(colorRes))
        } else {
            views.setTextColor(viewId, context.getColor(colorRes))
        }
    }

    fun backgroundColor(views: RemoteViews, viewId: Int, colorRes: Int) {
        if (Build.VERSION.SDK_INT >= 34) {
            views.setColorInt(viewId, "setBackgroundColor", day.getColor(colorRes), night.getColor(colorRes))
        } else {
            views.setInt(viewId, "setBackgroundColor", context.getColor(colorRes))
        }
    }

    /** a rounded drawable keeps its shape only when tinted, which needs Android 12 */
    fun tintBackground(views: RemoteViews, viewId: Int, colorRes: Int) {
        when {
            Build.VERSION.SDK_INT >= 34 ->
                views.setColorStateList(viewId, "setBackgroundTintList", ColorStateList.valueOf(day.getColor(colorRes)), ColorStateList.valueOf(night.getColor(colorRes)))
            Build.VERSION.SDK_INT >= 31 -> views.setColorStateList(viewId, "setBackgroundTintList", ColorStateList.valueOf(context.getColor(colorRes)))
            else -> views.setInt(viewId, "setBackgroundColor", context.getColor(colorRes))
        }
    }
}

internal fun tintBackgroundColor(views: RemoteViews, viewId: Int, color: Int) {
    if (Build.VERSION.SDK_INT >= 31) {
        views.setColorStateList(viewId, "setBackgroundTintList", ColorStateList.valueOf(color))
    } else {
        views.setInt(viewId, "setBackgroundColor", color)
    }
}

internal fun readableOn(color: Int): Int {
    val red = (color shr 16) and 0xFF
    val green = (color shr 8) and 0xFF
    val blue = color and 0xFF
    return if ((0.299 * red + 0.587 * green + 0.114 * blue) / 255 > 0.6) 0xFF000000.toInt() else 0xFFFFFFFF.toInt()
}

internal fun struck(text: String) = SpannableString(text).apply { setSpan(StrikethroughSpan(), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE) }

/** The row of a followed train: the widget and the notifications draw it with the same ids. */
internal fun bindTrainRow(context: Context, views: RemoteViews, row: TrainRow, now: Long, palette: Palette, timeFormat: java.text.DateFormat) {
    val cancelled = row.isCancelled()
    val (textColor, backgroundColor) = row.statusColors(now)

    views.setTextViewText(R.id.tf_badge, row.trainName)
    views.setViewVisibility(R.id.tf_number, if (row.trainNumber == null) View.GONE else View.VISIBLE)
    views.setTextViewText(R.id.tf_number, row.trainNumber ?: "")
    if (row.trainColor != null) {
        tintBackgroundColor(views, R.id.tf_badge, row.trainColor)
        views.setTextColor(R.id.tf_badge, row.trainTextColor ?: readableOn(row.trainColor))
    }
    views.setTextViewText(R.id.tf_stop, if (cancelled) struck(row.stopName) else row.stopName)
    bindSubtitle(context, views, row, now)

    palette.backgroundColor(views, R.id.tf_strip, textColor)
    val scheduledVisible = !cancelled && row.timeMillis != row.scheduledMillis
    views.setViewVisibility(R.id.tf_scheduled, if (scheduledVisible) View.VISIBLE else View.GONE)
    if (scheduledVisible) {
        views.setTextViewText(R.id.tf_scheduled, struck(timeFormat.format(Date(row.scheduledMillis))))
    }
    views.setViewVisibility(R.id.tf_time, if (cancelled) View.GONE else View.VISIBLE)
    views.setTextViewText(R.id.tf_time, timeFormat.format(Date(row.timeMillis)))
    palette.textColor(views, R.id.tf_time, textColor)

    views.setTextViewText(R.id.tf_chip, row.statusLabel(context, now))
    palette.textColor(views, R.id.tf_chip, textColor)
    palette.tintBackground(views, R.id.tf_chip, backgroundColor)
}

/** The next train and its change, for the views that include `train_change`. */
internal fun bindTrainChange(views: RemoteViews, row: TrainRow, palette: Palette, openApp: android.app.PendingIntent) {
    val change = row.change
    if (change == null) {
        views.setViewVisibility(R.id.tf_change, View.GONE)
        return
    }
    views.setViewVisibility(R.id.tf_change, View.VISIBLE)
    val (textColor, backgroundColor) = when (change.status) {
        "ok" -> R.color.tf_ok to R.color.tf_ok_bg
        "late" -> R.color.tf_warn to R.color.tf_warn_bg
        else -> R.color.tf_bad to R.color.tf_bad_bg
    }
    palette.tintBackground(views, R.id.tf_change, backgroundColor)
    views.setTextViewText(R.id.tf_change_label, change.label)
    palette.textColor(views, R.id.tf_change_label, textColor)
    views.setTextViewText(R.id.tf_change_badge, change.trainName)
    if (change.trainColor != null) {
        tintBackgroundColor(views, R.id.tf_change_badge, change.trainColor)
        views.setTextColor(R.id.tf_change_badge, change.trainTextColor ?: readableOn(change.trainColor))
    }
    views.setViewVisibility(R.id.tf_change_number, if (change.trainNumber == null) View.GONE else View.VISIBLE)
    views.setTextViewText(R.id.tf_change_number, change.trainNumber ?: "")
    views.setTextViewText(R.id.tf_change_text, change.text)
    palette.textColor(views, R.id.tf_change_text, textColor)
    views.setViewVisibility(R.id.tf_change_replan, if (change.showReplan) View.VISIBLE else View.GONE)
    views.setOnClickPendingIntent(R.id.tf_change_replan, openApp)
}

private fun bindSubtitle(context: Context, views: RemoteViews, row: TrainRow, now: Long) {
    val subtitle = row.subtitle(context)
    views.setViewVisibility(R.id.tf_subtitle, if (subtitle.isEmpty()) View.GONE else View.VISIBLE)
    if (row.countdownMillis > now && Build.VERSION.SDK_INT >= 24) {
        // the host keeps it ticking, and only while it is on screen
        views.setChronometerCountDown(R.id.tf_subtitle, true)
        views.setChronometer(R.id.tf_subtitle, SystemClock.elapsedRealtime() + (row.countdownMillis - now), subtitle, true)
    } else {
        views.setTextViewText(R.id.tf_subtitle, if (row.countdownMillis > 0) String.format(subtitle, "0:00") else subtitle)
    }
}
