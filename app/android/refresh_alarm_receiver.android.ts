import { scheduleRefreshAlarm } from '~/utils/utils';
import { ApplicationSettings } from '@nativescript/core';
import { getMapContext } from '~/mapModules/MapModule';
@JavaProxy('__PACKAGE__.RefreshAlarmReceiver')
@NativeClass
export class RefreshAlarmReceiver extends android.content.BroadcastReceiver {
    async onReceive(context: android.content.Context, intent: android.content.Intent) {
        DEV_LOG && console.log("AlarmReceiver", "Alarm triggered!")
        
        const broadcastIntent = new android.content.Intent(ApplicationSettings.getString('refreshAlarmBroadcast', "com.akylas.A9_REFRESH_SCREEN"));       
        const module = getMapContext().mapModule('userLocation');
        // we are waiting for a location update
        if (module) {
          broadcastIntent.set extra('sleep_delay', 0);
          module.once('location', ()=> {
              //1context.sendBroadcast(broadcastIntent);
          })
        } else {}
                
        context.sendBroadcast(broadcastIntent);
                
       // scheduleRefreshAlarm();
    }
}
