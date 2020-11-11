import { $t } from '~/helpers/locale';
import {
    ApplicationEventData,
    off as applicationOff,
    on as applicationOn,
    resumeEvent,
    suspendEvent,
} from '@nativescript/core/application';
import {
    GeoHandler,
    SessionChronoEvent,
    SessionChronoEventData,
    SessionEventData,
    SessionState,
    SessionStateEvent,
} from '~/handlers/GeoHandler';
import { BgServiceBinder } from '~/services/android/BgServiceBinder';
import { ACTION_PAUSE, ACTION_RESUME, NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, NotificationHelper } from './NotifcationHelper';

function titlecase(value) {
    return value.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
const DEFAULT_TEXT = titlecase($t('tap_to_open'));
const NOTIFICATION_ID = 3426824;

@JavaProxy('akylas.alpi.maps.BgService')
export class BgService extends android.app.Service {
    geoHandler: GeoHandler;
    builder: androidx.core.app.NotificationCompat.Builder;
    recording = false;
    currentNotifText: string;
    inBackground = false;
    bounded = false;

    alwaysShowNotification = false;

    notificationManager: android.app.NotificationManager;

    constructor() {
        super();
    }
    log(...args) {
        console.log('[BgService]', ...args);
    }
    onStartCommand(intent: android.content.Intent, flags: number, startId: number) {
        super.onStartCommand(intent, flags, startId);
        const action = intent ? intent.getAction() : null;
        // this.log('onStartCommand', this.inBackground, this.recording, this.alwaysShowNotification, action);
        if (action === ACTION_RESUME) {
            this.geoHandler.resumeSession();
        } else if (action === ACTION_PAUSE) {
            this.geoHandler.pauseSession();
        }
        return android.app.Service.START_STICKY;
    }
    onCreate() {
        this.currentNotifText = DEFAULT_TEXT;
        this.recording = false;
        this.inBackground = false;
        this.alwaysShowNotification = false; // oreo
        // this.alwaysShowNotification = android.os.Build.VERSION.SDK_INT >= 26; // oreo
        this.notificationManager = this.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        NotificationHelper.createNotificationChannel(this);
        // this.log('onCreate', this.inBackground, this.recording, this.alwaysShowNotification);
    }
    onDestroy() {
        // this.log('onDestroy');
        if (this.geoHandler) {
            this.geoHandler.off(SessionStateEvent, this.onSessionStateEvent, this);
            this.geoHandler.off(SessionChronoEvent, this.onSessionChronoEvent, this);
            this.geoHandler = null;
        }
        applicationOff(resumeEvent, this.onAppEvent, this);
        applicationOff(suspendEvent, this.onAppEvent, this);
    }

    onBind(intent: android.content.Intent) {
        // a client is binding to the service with bindService()
        this.bounded = true;
        const result = new BgServiceBinder();
        result.setService(this);
        // this.log('onBind', intent, result);
        return result;
    }
    onUnbind(intent: android.content.Intent) {
        this.bounded = false;
        // this.log('onUnbind', intent);
        this.removeForeground();
        // return true if you would like to have the service's onRebind(Intent) method later called when new clients bind to it.
        return true;
    }
    onRebind(intent: android.content.Intent) {
        // a client is binding to the service with bindService(), after onUnbind() has already been called
    }

    private mNotification: android.app.Notification;
    private mNotificationBuilder: androidx.core.app.NotificationCompat.Builder;
    displayNotification(sessionRunning) {
        this.mNotificationBuilder = new androidx.core.app.NotificationCompat.Builder(
            this,
            NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL
        );

        this.mNotification = NotificationHelper.getNotification(this, this.mNotificationBuilder, this.geoHandler.currentSession);
        this.notificationManager.notify(NOTIFICATION_ID, this.mNotification); // todo check if necessary in pre Android O
    }
    dismissNotification() {
        // cancel notification
        this.notificationManager.cancel(NOTIFICATION_ID); // todo check if necessary?
        this.stopForeground(android.app.Service.STOP_FOREGROUND_REMOVE);
        this.mNotification = null;
    }
    private onSessionStateEvent(e: SessionEventData) {
        // this.log('onSessionStateEvent', e.data.state);
        switch (e.data.state) {
            case SessionState.RUNNING:
                this.recording = true;
                break;
            case SessionState.STOPPED:
                this.recording = false;
                break;
        }
        this.updateNotification();
    }
    protected updateNotification() {
        if (!this.mNotificationBuilder) {
            this.displayNotification(this.recording);
        } else {
            this.mNotification = NotificationHelper.getUpdatedNotification(
                this,
                this.mNotificationBuilder,
                this.geoHandler.currentSession
            );
            this.notificationManager.notify(NOTIFICATION_ID, this.mNotification);
        }
    }
    protected onSessionChronoEvent(e: SessionChronoEventData) {
        this.updateNotification();
    }

    showForeground() {
        if (!this.bounded) {
            return;
        }
        this.log('showForeground', this.inBackground, this.recording, this.alwaysShowNotification, new Error().stack);
        if (this.inBackground || this.recording || this.alwaysShowNotification) {
            try {
                if (!this.mNotification) {
                    this.displayNotification(this.recording);
                }
                this.startForeground(NOTIFICATION_ID, this.mNotification);
            } catch (err) {
                console.error(err);
            }
        }
    }

    removeForeground() {
        // this.log('removeForeground', this.inBackground, this.recording, this.alwaysShowNotification);
        this.stopForeground(android.app.Service.STOP_FOREGROUND_DETACH);
        this.notificationManager.cancel(NOTIFICATION_ID);
    }
    onAppEvent(event: ApplicationEventData) {
        if (event.eventName === suspendEvent) {
            if (!this.inBackground) {
                this.inBackground = true;
            }
        } else if (event.eventName === resumeEvent) {
            if (this.inBackground) {
                this.inBackground = false;
                // if (!this.alwaysShowNotification) {
                // this.removeForeground();
                // }
            }
        }
    }
    onBounded() {
        // this.log('onBounded');
        this.geoHandler = new GeoHandler();
        this.geoHandler.on(SessionStateEvent, this.onSessionStateEvent, this);
        this.geoHandler.on(SessionChronoEvent, this.onSessionChronoEvent, this);
        applicationOn(resumeEvent, this.onAppEvent, this);
        applicationOn(suspendEvent, this.onAppEvent, this);
        // this.showForeground();
    }
}
