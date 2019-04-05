import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { GeoHandler, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { ad } from 'tns-core-modules/utils/utils';
import { ApplicationEventData, off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from 'tns-core-modules/application/application';
import { localize } from 'nativescript-localize';
import { primaryColor } from '~/variables';
import { clog } from '~/utils/logging';
// function getSystemResourceId(systemIcon: string): number {
//     return android.content.res.Resources.getSystem().getIdentifier(systemIcon, 'drawable', 'android');
// }

declare global {
    namespace akylas {
        export namespace alpi {
            export namespace maps {
                class BgService extends android.app.Service {}
            }
        }
    }
}
function titlecase(value) {
    return value.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
const DEFAULT_TEXT = titlecase(localize('tap_to_open'));
const FOREGROUND_ID = 3426824;
@JavaProxy('akylas.alpi.maps.BgService')
export class BgService extends android.app.Service {
    geoHandler: GeoHandler;
    builder: android.support.v4.app.NotificationCompat.Builder;
    recording = false;
    currentNotifText: string;
    inBackground = false;

    alwaysShowNotification = false;

    constructor() {
        super();
    }
    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        super.onStartCommand(intent, flags, startId);
        this.currentNotifText = DEFAULT_TEXT;
        this.recording = false;
        this.inBackground = false;
        this.alwaysShowNotification = android.os.Build.VERSION.SDK_INT >= 26; // oreo
        return android.app.Service.START_STICKY;
    }
    onCreate() {}
    onDestroy() {
        this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
        applicationOff(resumeEvent, this.onAppEvent, this);
        applicationOff(suspendEvent, this.onAppEvent, this);
        this.geoHandler = null;
    }

    onBind(intent: android.content.Intent) {
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }

    private createNotificationChannel(color) {
        const channelId = 'microoled_service';
        const channelName = 'Glasses background Service';
        const chan = new android.app.NotificationChannel(channelId, channelName, android.app.NotificationManager.IMPORTANCE_NONE);
        chan.setLightColor(color);
        // chan.lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE;
        const service = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
        service.createNotificationChannel(chan);
        return channelId;
    }
    private buildForegroundNotification() {
        let updateOnly = true;
        if (!this.builder) {
            updateOnly = false;
            this.builder = new android.support.v4.app.NotificationCompat.Builder(this);
        }
        // clog('buildForegroundNotification', this.currentNotifText, updateOnly);

        const builder = this.builder;

        if (updateOnly) {
            builder.setContentText(this.currentNotifText);
        } else {
            const context = ad.getApplicationContext(); // get a reference to the application context in Android
            const color = android.graphics.Color.parseColor(primaryColor);
            let channelId: string;
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                channelId = this.createNotificationChannel(color);
            }
            builder
                .setColor(color)
                .setOngoing(true)
                .setVisibility(android.support.v4.app.NotificationCompat.VISIBILITY_SECRET)
                .setPriority(android.support.v4.app.NotificationCompat.PRIORITY_MIN)
                .setOnlyAlertOnce(true)
                .setSmallIcon(ad.resources.getDrawableId('ic_stat'));
            // builder.setLargeIcon(bitmap)

            if (channelId) {
                builder.setChannelId(channelId);
                builder.setCategory(android.app.Notification.CATEGORY_SERVICE);
            }

            const mainIntent = new android.content.Intent(context, (com as any).tns.NativeScriptActivity.class);
            mainIntent.setAction(android.content.Intent.ACTION_MAIN);
            mainIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
            const pendingIntent = android.app.PendingIntent.getActivity(context, 0, mainIntent, 0);
            builder.setContentIntent(pendingIntent);
        }

        return builder.build();
    }

    private onSessionStateEvent(e: SessionEventData) {
        switch (e.data.state) {
            case SessionState.RUNNING:
                this.recording = true;
                clog('startForeground');
                this.updateNotifText('Chrono: 00:00:00');
                break;
            case SessionState.STOPPED:
                this.recording = false;
                if (!this.inBackground) {
                    this.removeForeground();
                }
                this.updateNotifText(DEFAULT_TEXT);
                break;
        }
    }

    updateNotifText(text: string) {
        this.currentNotifText = text || DEFAULT_TEXT;
        // clog('updateNotifText', text);
        // const service = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
        this.showForeground();
    }
    showForeground() {
        // clog('showForeground', this.inBackground, this.recording, this.alwaysShowNotification);
        if (this.inBackground || this.recording || this.alwaysShowNotification) {
            try {
                this.startForeground(FOREGROUND_ID, this.buildForegroundNotification());
            } catch (err) {
                console.error(err);
            }
        }
    }
    removeForeground() {
        // clog('removeForeground', this.inBackground, this.recording, this.alwaysShowNotification);
        this.stopForeground(true);
        const service = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
        service.cancel(FOREGROUND_ID);
        this.builder = null;
    }
    onAppEvent(event: ApplicationEventData) {
        if (event.eventName === suspendEvent) {
            if (!this.inBackground) {
                this.inBackground = true;
            }
        } else if (event.eventName === resumeEvent) {
            if (this.inBackground) {
                this.inBackground = false;
                if (!this.alwaysShowNotification) {
                    this.removeForeground();
                }
            }
        }
    }
    onBounded() {
        clog('onBounded');
        // this.showForeground();
        this.geoHandler = new GeoHandler();

        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        applicationOn(resumeEvent, this.onAppEvent, this);
        applicationOn(suspendEvent, this.onAppEvent, this);
    }
}
