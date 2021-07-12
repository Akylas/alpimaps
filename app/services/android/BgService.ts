import { GeoHandler, SessionChronoEvent, SessionChronoEventData, SessionEventData, SessionState, SessionStateEvent } from '~/handlers/GeoHandler';
import { lc } from '~/helpers/locale';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';

const NOTIFICATION_ID = 3426124;

@NativeClass
@JavaProxy('akylas.alpi.maps.BgService')
export class BgService extends android.app.Service {
    currentNotifText: string;
    geoHandler: GeoHandler;
    bounded: boolean;
    mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    mNotification: globalAndroid.app.Notification;
    notificationManager: any;
    recording: boolean;
    alwaysShowNotification: boolean;

    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        super.onStartCommand(intent, flags, startId);
        const action = intent ? intent.getAction() : null;
        if (action === ACTION_RESUME) {
            this.geoHandler.resumeSession();
        } else if (action === ACTION_PAUSE) {
            this.geoHandler.pauseSession();
        }
        return android.app.Service.START_STICKY;
    }
    onCreate() {
        this.currentNotifText = lc('tap_to_open');
        this.recording = false;
        // this.inBackground = false;
        this.bounded = false;
        this.alwaysShowNotification = false;
        // this.alwaysShowNotification = android.os.Build.VERSION.SDK_INT >= 26; // oreo
        this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannel(this);
    }
    onDestroy() {
        if (this.geoHandler) {
            this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler.off(SessionChronoEvent, this.onSessionChronoEvent, this);
            this.geoHandler = null;
        }
        // applicationOff(resumeEvent, this.onAppEvent, this);
        // applicationOff(suspendEvent, this.onAppEvent, this);
    }

    onBind(intent: android.content.Intent) {
        // a client is binding to the service with bindService()
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        this.bounded = false;
        this.removeForeground();
        // return true if you would like to have the service's onRebind(Intent) method later called when new clients bind to it.
        return true;
    }
    onRebind(intent: android.content.Intent) {
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    onBounded() {
        this.geoHandler = new GeoHandler();
        this.geoHandler.bgService = new WeakRef(this as any);
        // this.showForeground();
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandler.on(SessionChronoEvent, this.onSessionChronoEvent, this);
        // applicationOn(resumeEvent, this.onAppEvent, this);
        // applicationOn(suspendEvent, this.onAppEvent, this);
    }

    // private mNotification: android.app.Notification;
    // private mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    displayNotification(sessionRunning) {
        this.mNotificationBuilder = new androidx.core.app.NotificationCompat.Builder(this, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL);

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder, this.geoHandler.currentSession);
        this.notificationManager.notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }

    onSessionStateEvent(e: SessionEventData) {
        // const { positions, ...noLocs } = e.data;
        switch (e.data.state) {
            case SessionState.RUNNING:
                this.recording = true;
                this.updateNotification();
                break;
            case SessionState.STOPPED:
                this.recording = false;
                this.removeForeground();
                break;
        }
    }
    updateNotification() {
        if (!this.mNotificationBuilder) {
            this.displayNotification(this.recording);
        } else {
            this.mNotification = NotificationHelper.getUpdatedNotification(this, this.mNotificationBuilder, this.geoHandler.currentSession);
            this.notificationManager.notify(NOTIFICATION_ID, this.mNotification);
        }
    }
    onSessionChronoEvent(e: SessionChronoEventData) {
        this.updateNotification();
    }

    showForeground(force = false) {
        if (!this.bounded) {
            return;
        }
        if (force || this.recording || this.alwaysShowNotification) {
            try {
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                this.startForeground(NOTIFICATION_ID, this.mNotification);
            } catch (err) {
                console.error('showForeground', err, err['stack']);
            }
        }
    }

    removeForeground() {
        this.stopForeground(false);
        this.notificationManager.cancel(NOTIFICATION_ID);
        this.mNotification = null;
    }

    // onAppEvent(event: ApplicationEventData) {
    //     if (event.eventName === suspendEvent) {
    //         if (!this.inBackground) {
    //             this.inBackground = true;
    //         }
    //     } else if (event.eventName === resumeEvent) {
    //         if (this.inBackground) {
    //             this.inBackground = false;
    //         }
    //     }
    // }
}
