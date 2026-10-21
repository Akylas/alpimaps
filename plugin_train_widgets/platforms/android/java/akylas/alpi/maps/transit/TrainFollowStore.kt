package akylas.alpi.maps.transit

import android.content.Context
import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

/** One followed train as the widget draws it: the stored follow, overridden by the last fetched state when there is one. */
internal data class TrainRow(
    val id: String,
    val trainName: String,
    val trainNumber: String?,
    val trainColor: Int?,
    val trainTextColor: Int?,
    val stopName: String,
    val origin: String?,
    val track: String?,
    val timeMillis: Long,
    val scheduledMillis: Long,
    /** 0 when unknown */
    val departureMillis: Long,
    val delayMinutes: Int,
    val status: String,
    val fetchedAtMillis: Long,
    val expiresAtMillis: Long,
    // itinerary rows only: the text is composed by the follow, not from an arrival
    val isItinerary: Boolean = false,
    val subtitleText: String? = null,
    val legFrom: String? = null,
    val legTo: String? = null,
    val change: TrainChange? = null,
    /** while waiting to leave: when, so the subtitle counts down by itself, with no redraw. `subtitleText` then holds a `%s` for the time left */
    val countdownMillis: Long = 0L
)

object TrainFollowStore {
    const val MAX_FOLLOWS = 3
    const val RESULT_ADDED = 0
    const val RESULT_EXISTS = 1
    const val RESULT_FULL = 2

    private const val PREFS = "alpimaps_train_follow"
    private const val KEY_FOLLOWS = "follows"
    private const val KEY_MODELS = "models"
    private const val KEEP_AFTER_ARRIVAL = 60 * 60 * 1000L

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun readFollows(context: Context) = JSONArray(prefs(context).getString(KEY_FOLLOWS, "[]"))

    private fun readModels(context: Context) = JSONObject(prefs(context).getString(KEY_MODELS, "{}"))

    @JvmStatic
    @Synchronized
    fun getFollowsJson(context: Context): String = readFollows(context).toString()

    @JvmStatic
    @Synchronized
    fun getModelsJson(context: Context): String = readModels(context).toString()

    @JvmStatic
    @Synchronized
    fun addFollow(context: Context, followJson: String): Int {
        val follows = readFollows(context)
        val follow = JSONObject(followJson)
        val id = follow.getString("id")
        for (index in 0 until follows.length()) {
            if (follows.getJSONObject(index).getString("id") == id) {
                return RESULT_EXISTS
            }
        }
        if (follows.length() >= MAX_FOLLOWS) {
            return RESULT_FULL
        }
        follows.put(follow)
        prefs(context).edit().putString(KEY_FOLLOWS, follows.toString()).apply()
        onChanged(context)
        return RESULT_ADDED
    }

    @JvmStatic
    @Synchronized
    fun removeFollow(context: Context, id: String) {
        val follows = readFollows(context)
        val kept = JSONArray()
        for (index in 0 until follows.length()) {
            val follow = follows.getJSONObject(index)
            if (follow.getString("id") != id) {
                kept.put(follow)
            }
        }
        val models = readModels(context)
        models.remove(id)
        prefs(context).edit().putString(KEY_FOLLOWS, kept.toString()).putString(KEY_MODELS, models.toString()).apply()
        if (kept.length() == 0) {
            TrainFollowScheduler.cancel(context)
        }
        onChanged(context)
    }

    @JvmStatic
    @Synchronized
    fun saveModel(context: Context, id: String, modelJson: String) {
        val models = readModels(context)
        models.put(id, JSONObject(modelJson))
        prefs(context).edit().putString(KEY_MODELS, models.toString()).apply()
        onChanged(context)
    }

    @JvmStatic
    @Synchronized
    fun hasFollows(context: Context) = readFollows(context).length() > 0

    /** widgets and notifications both follow the store: a notification must work with no widget placed */
    private fun onChanged(context: Context) {
        TrainWidgetProvider.updateAll(context)
        TrainNotifier.update(context)
    }

    internal fun parseColor(value: String?): Int? =
        try {
            if (value.isNullOrEmpty()) null else Color.parseColor(value)
        } catch (error: IllegalArgumentException) {
            null
        }

    @Synchronized
    internal fun readRows(context: Context): List<TrainRow> {
        val follows = readFollows(context)
        val models = readModels(context)
        val now = System.currentTimeMillis()
        return (0 until follows.length()).mapNotNull { index ->
            val follow = follows.getJSONObject(index)
            val model = models.optJSONObject(follow.getString("id"))
            if (follow.optString("kind") == "itinerary") {
                return@mapNotNull itineraryRow(context, follow, model, now)
            }
            val scheduled = follow.getLong("scheduledArrivalMillis")
            TrainRow(
                id = follow.getString("id"),
                trainName = follow.optString("trainName"),
                trainNumber = follow.optString("trainNumber").ifEmpty { null },
                trainColor = parseColor(follow.optString("trainColor")),
                trainTextColor = parseColor(follow.optString("trainTextColor")),
                stopName = follow.optString("stopName"),
                origin = follow.optString("origin").ifEmpty { null },
                track = model?.optString("track")?.ifEmpty { null },
                timeMillis = model?.optLong("timeMillis", scheduled) ?: scheduled,
                scheduledMillis = model?.optLong("scheduledMillis", scheduled) ?: scheduled,
                departureMillis = model?.optLong("departureMillis", 0L) ?: 0L,
                delayMinutes = model?.optInt("delayMinutes", 0) ?: 0,
                status = model?.optString("status", "ok") ?: "ok",
                fetchedAtMillis = model?.optLong("fetchedAtMillis", 0L) ?: 0L,
                expiresAtMillis = model?.optLong("expiresAtMillis", scheduled + KEEP_AFTER_ARRIVAL) ?: (scheduled + KEEP_AFTER_ARRIVAL)
            )
        }.sortedBy { it.timeMillis }
    }
}
