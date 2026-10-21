package akylas.alpi.maps.transit

import android.content.Context

internal const val STALE_AFTER = 15 * 60 * 1000L

internal fun TrainRow.isCancelled() = status == "cancelled"

internal fun TrainRow.isArrived(now: Long) = !isCancelled() && status != "lost" && now >= timeMillis

/** the last fetch is old, and nothing else says what the train is doing */
internal fun TrainRow.isStale(now: Long) = !isArrived(now) && !isCancelled() && now - fetchedAtMillis > STALE_AFTER

/** text and background color resources of the status */
internal fun TrainRow.statusColors(now: Long): Pair<Int, Int> =
    when {
        isStale(now) -> R.color.tf_text_secondary to R.color.tf_card_alt
        status == "ok" -> R.color.tf_ok to R.color.tf_ok_bg
        status == "late" -> R.color.tf_warn to R.color.tf_warn_bg
        else -> R.color.tf_bad to R.color.tf_bad_bg
    }

internal fun TrainRow.statusLabel(context: Context, now: Long): String =
    when {
        isCancelled() -> context.getString(R.string.tf_cancelled)
        status == "lost" -> context.getString(R.string.tf_lost)
        // a trip goes on after one train: its delay is the useful word
        isArrived(now) && !isItinerary -> context.getString(R.string.tf_arrived)
        delayMinutes >= 2 -> context.getString(R.string.tf_delay, delayMinutes)
        else -> context.getString(R.string.tf_on_time)
    }

internal fun TrainRow.subtitle(context: Context): String =
    subtitleText ?: listOfNotNull(
        origin?.let { context.getString(R.string.tf_from, it) },
        track?.let { context.getString(R.string.tf_track, it) }
    ).joinToString(" · ")

/** how far along its trip the train is, in percent; null when there is nothing to draw */
internal fun TrainRow.progressPercent(now: Long): Int? {
    if (isCancelled() || departureMillis <= 0 || timeMillis <= departureMillis) {
        return null
    }
    return ((now - departureMillis) * 100 / (timeMillis - departureMillis)).coerceIn(0, 100).toInt()
}
