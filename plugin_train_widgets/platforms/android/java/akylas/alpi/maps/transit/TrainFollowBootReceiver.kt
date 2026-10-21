package akylas.alpi.maps.transit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** A reboot clears the alarm and the notifications: start following again, with or without a widget. */
class TrainFollowBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (TrainFollowStore.hasFollows(context)) {
            TrainNotifier.update(context)
            TrainFollowScheduler.requestRefresh(context, TrainFollowScheduler.ACTION_ALARM)
        }
    }
}
