package akylas.alpi.maps.transit

import android.content.Context
import android.text.format.DateFormat
import java.util.Date
import org.json.JSONObject

/** The line under a followed trip: the next train, and whether its change still holds. */
internal data class TrainChange(
    val label: String,
    val trainName: String,
    val trainNumber: String?,
    val trainColor: Int?,
    val trainTextColor: Int?,
    val text: String,
    /** ok, late (at risk) or veryLate (missed): the same colors as a row */
    val status: String,
    val showReplan: Boolean
)

private const val MINUTE = 60 * 1000L
private const val RISKY_BELOW = 10

/**
 * A trip is several trains. The follow holds the trains (`legs`: trainName, trainNumber, colors, from, to) and `title`;
 * the model holds the times of each leg and the `connections` between them. Which leg is current comes from the clock.
 */
internal fun itineraryRow(context: Context, follow: JSONObject, model: JSONObject?, now: Long): TrainRow? {
    val legsFollow = follow.optJSONArray("legs")
    val legsModel = model?.optJSONArray("legs")
    if (model == null || legsFollow == null || legsModel == null) {
        return null
    }
    val count = minOf(legsFollow.length(), legsModel.length())
    if (count == 0) {
        return null
    }
    val connections = model.optJSONArray("connections")
    fun connectionMinutes(index: Int) = connections?.optJSONObject(index)?.optInt("minutes", 60)
    val current = (0 until count).firstOrNull { legsModel.getJSONObject(it).getLong("arrivalMillis") > now } ?: (count - 1)
    // the change before the current train already failed: show the train we arrived on, and the one that left
    val missedBefore = current > 0 && (connectionMinutes(current - 1) ?: 60) <= 0
    val shown = if (missedBefore) current - 1 else current
    val legFollow = legsFollow.getJSONObject(shown)
    val legModel = legsModel.getJSONObject(shown)
    val timeFormat = DateFormat.getTimeFormat(context)
    val title = follow.optString("title")

    val departure = legModel.getLong("departureMillis")
    val arrival = legModel.getLong("arrivalMillis")
    val waiting = now < departure && !missedBefore
    val time = if (waiting) departure else arrival
    val scheduled = if (waiting) legModel.getLong("scheduledDepartureMillis") else legModel.getLong("scheduledArrivalMillis")
    val delay = ((time - scheduled) / MINUTE).toInt()

    var changeStatus = "ok"
    var change: TrainChange? = null
    if (shown + 1 < count) {
        val next = legsFollow.getJSONObject(shown + 1)
        val nextDeparture = legsModel.getJSONObject(shown + 1).getLong("departureMillis")
        val connection = connections?.optJSONObject(shown)
        val minutes = connection?.optInt("minutes", 60) ?: 60
        val scheduledMinutes = connection?.optInt("scheduledMinutes", minutes) ?: minutes
        val at = timeFormat.format(Date(nextDeparture))
        val (label, text, status) = when {
            legsModel.getJSONObject(shown + 1).optBoolean("cancelled", false) -> Triple(context.getString(R.string.tf_change_next), context.getString(R.string.tf_cancelled), "veryLate")
            minutes <= 0 -> Triple(context.getString(R.string.tf_change_missed), context.getString(R.string.tf_left_at, at), "veryLate")
            minutes < minOf(scheduledMinutes, RISKY_BELOW) -> Triple(context.getString(R.string.tf_change_risk), context.getString(R.string.tf_connect_risk, at, minutes, scheduledMinutes), "late")
            else -> Triple(context.getString(R.string.tf_change_next), context.getString(R.string.tf_connect, at, minutes), "ok")
        }
        changeStatus = status
        change = TrainChange(
            label = label,
            trainName = next.optString("trainName"),
            trainNumber = next.optString("trainNumber").ifEmpty { null },
            trainColor = TrainFollowStore.parseColor(next.optString("trainColor")),
            trainTextColor = TrainFollowStore.parseColor(next.optString("trainTextColor")),
            text = text,
            status = status,
            showReplan = status == "veryLate"
        )
    }
    val delayStatus = if (delay >= 15) "veryLate" else if (delay >= 2) "late" else "ok"
    val status = when {
        legModel.optBoolean("cancelled", false) -> "cancelled"
        changeStatus == "veryLate" -> "veryLate"
        changeStatus == "late" && delayStatus == "ok" -> "late"
        else -> delayStatus
    }

    val track = legModel.optString("track").ifEmpty { null }
    val heading = when {
        missedBefore -> context.getString(R.string.tf_change_missed_title)
        waiting -> title
        else -> context.getString(R.string.tf_on_board, legFollow.optString("to"))
    }
    // waiting: the time left is a chronometer's, which keeps counting while nothing redraws the row
    val subtitle = if (waiting) {
        listOfNotNull(context.getString(R.string.tf_leaves_countdown), track?.let { context.getString(R.string.tf_track, it).replace("%", "%%") }).joinToString(" · ")
    } else {
        title
    }
    return TrainRow(
        id = follow.getString("id"),
        trainName = legFollow.optString("trainName"),
        trainNumber = legFollow.optString("trainNumber").ifEmpty { null },
        trainColor = TrainFollowStore.parseColor(legFollow.optString("trainColor")),
        trainTextColor = TrainFollowStore.parseColor(legFollow.optString("trainTextColor")),
        stopName = heading,
        origin = null,
        track = track,
        timeMillis = time,
        scheduledMillis = scheduled,
        departureMillis = if (waiting) 0L else departure,
        delayMinutes = delay,
        status = status,
        fetchedAtMillis = model.optLong("fetchedAtMillis", 0L),
        expiresAtMillis = model.optLong("expiresAtMillis", arrival + 60 * MINUTE),
        isItinerary = true,
        subtitleText = subtitle,
        legFrom = legFollow.optString("from").ifEmpty { null },
        legTo = legFollow.optString("to").ifEmpty { null },
        change = change,
        countdownMillis = if (waiting) departure else 0L
    )
}
