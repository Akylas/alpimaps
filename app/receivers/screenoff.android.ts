import { startRefreshAlarm, stopRefreshAlarm } from '~/utils/utils';

@NativeClass
export class ScreenOnOffReceiver extends android.content.BroadcastReceiver {
    constructor(private args) {
        super(args);
    }
    onReceive(context: android.content.Context, intent: android.content.Intent) {
        DEV_LOG && console.log("ScreenOnOffReceiver");
        const action = intent.getAction();
            DEV_LOG && console.log('screenOnOffReceiver', action);
              if (action === android.content.Intent.ACTION_SCREEN_ON) {
                DEV_LOG && console.log("Screen ON");
                stopRefreshAlarm();
              } else if (action === android.content.Intent.ACTION_SCREEN_OFF) {
                DEV_LOG && console.log("Screen OFF");
                startRefreshAlarm();
              }
    }
}
