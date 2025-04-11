import { scheduleRefreshAlarm } from '~/utils/utils';

@JavaProxy('__PACKAGE__.RefreshAlarmReceiver')
@NativeClass
export class RefreshAlarmReceiver extends android.content.BroadcastReceiver {
    async onReceive(context: android.content.Context, intent: android.content.Intent) {
        DEV_LOG && console.log("AlarmReceiver", "Alarm triggered!")
        
        const broadcastIntent = android.content.Intent(ApplicationSettings.getString('refreshAlarmBroadcast', "com.akylas.A9_REFRESH_SCREEN"));
        context.sendBroadcast(broadcastIntent);
        
        scheduleRefreshAlarm();
    }
}
