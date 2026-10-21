import { trainFollowService } from '~/services/TrainFollowService';

/** Woken by the follow alarm or the widget's refresh button: fetches the followed trains, then lets the widget redraw. */
@NativeClass
@JavaProxy('akylas.alpi.maps.transit.TrainFollowReceiver')
export class TrainFollowReceiver extends android.content.BroadcastReceiver {
    constructor() {
        super();
        return global.__native(this);
    }
    onReceive(context: android.content.Context, intent: android.content.Intent) {
        // the process may be killed as soon as onReceive returns
        const pendingResult = this.goAsync();
        const force = intent.getAction() === akylas.alpi.maps.transit.TrainFollowScheduler.ACTION_REFRESH;
        trainFollowService
            .refreshAll(force)
            .catch((error) => console.error('TrainFollowReceiver', error, error?.stack))
            .finally(() => pendingResult.finish());
    }
}
