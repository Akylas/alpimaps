package akylas.alpi.maps.transit

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/** Wakes the JS receiver, which does the fetching. The receiver class is generated from the app's JS, so it is only named here. */
object TrainFollowScheduler {
    const val RECEIVER_CLASS = "akylas.alpi.maps.transit.TrainFollowReceiver"
    const val ACTION_ALARM = "akylas.alpi.maps.transit.ALARM"
    /** the user asked: the minimum delay between two fetches does not apply */
    const val ACTION_REFRESH = "akylas.alpi.maps.transit.REFRESH"

    private fun intentFor(context: Context, action: String) = Intent().setClassName(context.packageName, RECEIVER_CLASS).setAction(action)

    @JvmStatic
    fun pendingIntent(context: Context, action: String): PendingIntent =
        PendingIntent.getBroadcast(context, 0, intentFor(context, action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    @JvmStatic
    fun requestRefresh(context: Context, action: String) = context.sendBroadcast(intentFor(context, action))

    @JvmStatic
    fun schedule(context: Context, atMillis: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pendingIntent(context, ACTION_ALARM))
    }

    @JvmStatic
    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarmManager.cancel(pendingIntent(context, ACTION_ALARM))
    }
}
