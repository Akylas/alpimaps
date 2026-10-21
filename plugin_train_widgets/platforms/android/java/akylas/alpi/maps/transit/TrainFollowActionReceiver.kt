package akylas.alpi.maps.transit

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The remove buttons of the widget and of the notifications. No JS needed, so it works with the app killed. */
class TrainFollowActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_REMOVE) {
            intent.getStringExtra(EXTRA_ID)?.let { TrainFollowStore.removeFollow(context, it) }
        }
    }

    companion object {
        const val ACTION_REMOVE = "akylas.alpi.maps.transit.REMOVE"
        const val EXTRA_ID = "id"

        internal fun removeIntent(context: Context, id: String): PendingIntent {
            val intent = Intent(context, TrainFollowActionReceiver::class.java).setAction(ACTION_REMOVE).putExtra(EXTRA_ID, id)
            return PendingIntent.getBroadcast(context, id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
    }
}
