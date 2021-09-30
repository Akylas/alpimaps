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

export class NotificationHelper {
    /* Creates a notification builder */
    public static getNotification(context: android.content.Context, builder: androidx.core.app.NotificationCompat.Builder, session: Session) {
        // create notification channel
        const color = primaryColor.android;
        NotificationHelper.createNotificationChannel(context);

        const activityClass = (com as any).tns.NativeScriptActivity.class;
        // ACTION: NOTIFICATION TAP & BUTTON SHOW
        const tapActionIntent = new android.content.Intent(context, activityClass);
        tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
        tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
        // artificial back stack for started Activity (https://developer.android.com/training/notify-user/navigation.html#DirectEntry)
        // const tapActionIntentBuilder = TaskStackBuilder.create(context);
        // tapActionIntentBuilder.addParentStack(MainActivity.class);
        // tapActionIntentBuilder.addNextIntent(tapActionIntent);
        // pending intent wrapper for notification tap
        const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);
        // tapActionIntentBuilder.getPendingIntent(10, PendingIntent.FLAG_UPDATE_CURRENT);

        // ACTION: NOTIFICATION BUTTON STOP
        // const stopActionIntent = new android.content.Intent(context, activityClass);
        // stopActionIntent.setAction(ACTION_STOP);
        // pending intent wrapper for notification stop action
        // const stopActionPendingIntent = android.app.PendingIntent.getService(context, 14, stopActionIntent, 0);

        // ACTION: NOTIFICATION BUTTON RESUME
        // const resumeActionIntent = new android.content.Intent(context, activityClass);
        // resumeActionIntent.setAction(ACTION_RESUME);
        // pending intent wrapper for notification resume action
        // const resumeActionPendingIntent = android.app.PendingIntent.getService(context, 16, resumeActionIntent, 0);

        // construct notification in builder
        builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_SECRET);
        builder.setShowWhen(false);
        builder.setOngoing(true);
        builder.setColor(color);
        builder.setOnlyAlertOnce(true);
        builder.setPriority(androidx.core.app.NotificationCompat.PRIORITY_MIN);
        builder.setContentIntent(tapActionPendingIntent);
        builder.setSmallIcon(ad.resources.getDrawableId('ic_stat_logo'));
        // builder.setLargeIcon(NotificationHelper.getNotificationIconLarge(context, tracking));
        NotificationHelper.updateBuilderTexts(builder, session);
        return builder.build();
    }

    public static updateBuilderTexts(builder: androidx.core.app.NotificationCompat.Builder, session: Session) {
        builder.setContentTitle(null);
        if (session) {
            // builder.setContentText(NotificationHelper.getSessionString(session));
        } else {
            builder.setContentText(lc('tap_to_open'));
        }
    }

    /* Constructs an updated notification */
    public static getUpdatedNotification(context, builder, session: Session) {
        NotificationHelper.updateBuilderTexts(builder, session);
        return builder.build();
    }

    /* Create a notification channel */
    public static createNotificationChannel(context) {
        const color = primaryColor.android;
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            const NotificationManager = android.app.NotificationManager;
            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
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

    /* Get station image for notification's large icon */
    private static getNotificationIconLarge(context, tracking) {
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
    private static getBitmap(context, resource) {
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
