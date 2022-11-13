import { Session, SessionState } from '~/handlers/GeoHandler';
import { lc, lt } from '~/helpers/locale';
import { ad } from '@nativescript/core/utils/utils';

export const ACTION_START = 'akylas.alpi.maps.action.START';
export const ACTION_STOP = 'akylas.alpi.maps.action.STOP';
export const ACTION_RESUME = 'akylas.alpi.maps.action.RESUME';
export const ACTION_PAUSE = 'akylas.alpi.maps.action.PAUSE';
export const NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL = 'alpimaps_service';
export const NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL = 'alpimaps_keepawake';
// export const NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL = 'alpimaps_screenshot';

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
        if (sdkVersion >= 26) {
            const service = getNotificationManager();
            // create channel
            let channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_RECORDING_CHANNEL, lt('location_notification'), NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(lt('location_notification_desc'));
            channel.setLightColor(color);
            service.createNotificationChannel(channel);

            channel = new android.app.NotificationChannel(NOTIFICATION_CHANEL_ID_KEEP_AWAKE_CHANNEL, lt('keepawake_notification'), NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(lt('keepawake_notification_desc'));
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
}
