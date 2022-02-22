import { Session, SessionState } from '~/handlers/GeoHandler';
import { lc } from '~/helpers/locale';
import { ad } from '@nativescript/core/utils/utils';

export const ACTION_START = 'akylas.alpi.maps.action.START';
export const ACTION_STOP = 'akylas.alpi.maps.action.STOP';
export const ACTION_RESUME = 'akylas.alpi.maps.action.RESUME';
export const ACTION_PAUSE = 'akylas.alpi.maps.action.PAUSE';
export const NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL = 'alpimaps_service';
export const NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL = 'alpimaps_keepawake';
export const NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL = 'alpimaps_screenshot';

import { primaryColor } from '~/variables';
import { sdkVersion } from '~/utils/utils';

export namespace NotificationHelper {
    const NotificationManager = android.app.NotificationManager;
    const NotificationCompat = androidx.core.app.NotificationCompat;
    const Intent = android.content.Intent;
    /* Creates a notification builder */
    export function getNotification(context: android.content.Context, options: { title?: string; channel?: string; builder?: androidx.core.app.NotificationCompat.Builder } = {}) {
        const builder = options.builder || new NotificationCompat.Builder(context, options.channel);
        const color = primaryColor.android;
        const activityClass = (com as any).tns.NativeScriptActivity.class;
        const tapActionIntent = new Intent(context, activityClass);
        tapActionIntent.setAction(Intent.ACTION_MAIN);
        tapActionIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        const FLAG_IMMUTABLE = 0x04000000; //android.app.PendingIntent.FLAG_IMMUTABLE
        const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, FLAG_IMMUTABLE);
        builder.setVisibility(NotificationCompat.VISIBILITY_SECRET);
        builder.setShowWhen(false);
        builder.setOngoing(true);
        builder.setColor(color);
        builder.setOnlyAlertOnce(true);
        builder.setPriority(NotificationCompat.PRIORITY_MIN);
        builder.setContentIntent(tapActionPendingIntent);
        builder.setSmallIcon(ad.resources.getDrawableId('ic_stat_logo'));
        builder.setContentTitle(options.title || null);
        return builder;
    }
    export function getLocationNotification(context: android.content.Context, builder: androidx.core.app.NotificationCompat.Builder, session: Session) {
        const nBuilder = getNotification(context, {
            builder
        });
        updateBuilderTexts(nBuilder, session);
        return nBuilder.build();
    }

    export function updateBuilderTexts(builder: androidx.core.app.NotificationCompat.Builder, session: Session) {
        builder.setContentTitle(null);
        if (session) {
            // builder.setContentText(NotificationHelper.getSessionString(session));
        } else {
            builder.setContentText(lc('tap_to_open'));
        }
    }

    /* Constructs an updated notification */
    export function getUpdatedNotification(context, builder, session: Session) {
        updateBuilderTexts(builder, session);
        return builder.build();
    }

    /* Create a notification channel */
    export function createNotificationChannel() {
        const color = primaryColor.android;
        if (sdkVersion() >= 26) {
            const service = getNotificationManager();
            // create channel
            let channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, 'Alpi Maps Record Session', NotificationManager.IMPORTANCE_LOW);
            channel.setDescription('Display current Map');
            channel.setLightColor(color);
            service.createNotificationChannel(channel);

            channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, 'Alpi Maps Keep Awake', NotificationManager.IMPORTANCE_LOW);
            channel.setDescription('Notify when Alpi Maps is keeping screen awake');
            channel.setLightColor(color);
            service.createNotificationChannel(channel);

            channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL, 'Alpi Maps Map Notification', NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription('Show Notification on LockScreen');
            channel.setLightColor(color);
            service.createNotificationChannel(channel);
            return true;
        } else {
            return false;
        }
    }
    let notificationManager: android.app.NotificationManager;
    function getNotificationManager() {
        if (!notificationManager) {
            const context: android.content.Context = ad.getApplicationContext();
            notificationManager = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        }
        return notificationManager;
    }

    export function showNotification(notification: android.app.Notification, id: number) {
        const service = getNotificationManager();
        service.notify(id, notification);
    }

    export function hideNotification(id: number) {
        const service = getNotificationManager();
        service.cancel(id);
    }

    /* Get station image for notification's large icon */
    function getNotificationIconLarge(context, tracking) {
        // get dimensions
        // const resources = context.getResources();
        // const height = resources.getDimension(android.R.dimen.notification_large_icon_height);
        // const width = resources.getDimension(android.R.dimen.notification_large_icon_width);

        let bitmap;
        if (tracking) {
            bitmap = ad.resources.getDrawableId('big_icon_tracking');
        } else {
            bitmap = ad.resources.getDrawableId('big_icon_not_tracking');
        }
        return bitmap;

        // return android.graphics.Bitmap.createScaledBitmap(bitmap, width, height, false);
    }

    /* Return a bitmap for a given resource id of a vector drawable */
    function getBitmap(context, resource) {
        // const drawable = VectorDrawableCompat.create(context.getResources(), resource, null);
        // if (drawable != null) {
        //     Bitmap bitmap = Bitmap.createBitmap(drawable.getIntrinsicWidth(), drawable.getIntrinsicHeight(), Bitmap.Config.ARGB_8888);
        //     Canvas canvas = new Canvas(bitmap);
        //     drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        //     drawable.draw(canvas);
        //     return bitmap;
        // } else {
        return null;
        // }
    }

    /* Build context text for notification builder */
    // private static getSessionString(session: Session) {
    //     if (session.state === SessionState.RUNNING) {
    //         return `${localize('distance')}: ${formatValueToUnit(session.distance, UNITS.DistanceKm)} | ${localize('duration')}: ${convertDuration(
    //             Date.now() - session.startTime.valueOf() - session.pauseDuration,
    //             'HH:mm:ss'
    //         )}`;
    //     } else if (session.state === SessionState.PAUSED) {
    //         return `${localize('distance')}: ${formatValueToUnit(session.distance, UNITS.DistanceKm)} | ${localize('duration')}: ${convertDuration(
    //             session.lastPauseTime.valueOf() - session.startTime.valueOf() - session.pauseDuration,
    //             'HH:mm:ss'
    //         )}`;
    //     } else {
    //         return null;
    //     }
    // }
}
