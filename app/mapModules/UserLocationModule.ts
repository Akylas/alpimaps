import { lc } from '@nativescript-community/l';
import { TWEEN } from '@nativescript-community/tween';
import { MapPos, MapPosVector } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Color } from '@nativescript/core/color';
import { ad } from '@nativescript/core/utils/utils';
import dayjs from 'dayjs';
import { get, writable } from 'svelte/store';
import { GeoHandler, GeoLocation, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import { NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL } from '~/services/android/NotifcationHelper';
import { EARTH_RADIUS } from '~/utils/geo';
import { accentColor } from '~/variables';
import MapModule, { getMapContext } from './MapModule';
import mapStore from '~/stores/mapStore';
import { ApplicationSettings } from '@nativescript/core';
import { packageService } from '~/services/PackageService';

const LOCATION_ANIMATION_DURATION = 300;
const SCREENSHOT_NOTIFICATION_ID = 23466571;

// const NOTIFICATION_SERVICE = android.content.Context.NOTIFICATION_SERVICE;

const mapContext = getMapContext();

export default class UserLocationModule extends MapModule {
    localBackVectorDataSource: LocalVectorDataSource;
    localVectorDataSource: LocalVectorDataSource;
    localBackVectorLayer: VectorLayer;
    localVectorLayer: VectorLayer;
    userBackMarker: Point<LatLonKeys>;
    userMarker: Point<LatLonKeys>;
    accuracyMarker: Polygon<LatLonKeys>;
    _userFollow = true;
    get userFollow() {
        return this._userFollow;
    }
    set userFollow(value: boolean) {
        if (value !== this._userFollow) {
            // console.log('set userFollow', value);
            this._userFollow = value;
            if (value) {
                // this.mapComp.askUserLocation();
            }
        }
    }

    onMapDestroyed() {
        super.onMapDestroyed();
        this.localVectorLayer = null;
        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
    }

    getCirclePoints(loc: Partial<MapPos<LatLonKeys> & { horizontalAccuracy: number }>) {
        const centerLat = loc.lat;
        const centerLon = loc.lon;
        const radius = loc.horizontalAccuracy;
        const N = Math.min(radius * 8, 100);

        const points = new MapPosVector<LatLonKeys>();

        for (let i = 0; i <= N; i++) {
            const angle = (Math.PI * 2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat = centerLat + (180 / Math.PI) * (dy / EARTH_RADIUS);
            const lon = centerLon + ((180 / Math.PI) * (dx / EARTH_RADIUS)) / Math.cos((centerLat * Math.PI) / 180);
            points.add({ lat, lon } as any);
        }

        return points;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapView.projection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            this.localVectorLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.localVectorDataSource });
            this.localVectorLayer.setVectorElementEventListener<LatLonKeys>({
                onVectorElementClicked: (data) => mapContext.vectorElementClicked(data)
            });
            this.localBackVectorDataSource = new LocalVectorDataSource({ projection });

            this.localBackVectorLayer = new VectorLayer({
                visibleZoomRange: [0, 24],
                dataSource: this.localBackVectorDataSource
            });

            // always add it at 1 to respect local order
            mapContext.addLayer(this.localBackVectorLayer, 'userLocation');
            mapContext.addLayer(this.localVectorLayer, 'userLocation');
        }
    }
    onMapMove(e) {
        this.userFollow = !e.data.userAction;
    }
    public mLastUserLocation: MapPos<LatLonKeys> & { horizontalAccuracy: number; verticalAccuracy: number; speed: number } = null;
    get lastUserLocation() {
        return this.mLastUserLocation;
    }
    set lastUserLocation(value) {
        // console.log('set lastUserLocation', value);
        this.mLastUserLocation = value;
        this.notify({
            eventName: 'location',
            object: this,
            data: value
        });
        if (global.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const myKM = context.getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager;
            const locked = myKM.isKeyguardLocked();
            // console.log('onNewLocation', locked);
            if (locked) {
                // it is locked
                this.showMapAsAlbumArt();
            } else {
                // it is not locked
                this.hideScreenshotNotification();
            }
        }
    }

    async updateUserLocation(geoPos: GeoLocation) {
        const position = {
            ...geoPos
        };
        if (
            !this.mapView ||
            (this.lastUserLocation &&
                this.lastUserLocation.lat === geoPos.lat &&
                this.lastUserLocation.lon === geoPos.lon &&
                this.lastUserLocation.horizontalAccuracy === geoPos.horizontalAccuracy)
        ) {
            return;
        }

        const altitude = await packageService.getElevation(geoPos);
        if (altitude !== null) {
            position.altitude = Math.round(altitude);
        }

        // if (!!this.userFollow) {
        //     this.mapView.focusPos = position;
        //     this.mapView.zoom = 16;
        // }
        let accuracyColor = '#0e7afe';
        const accuracy = geoPos.horizontalAccuracy || 0;
        const deltaMinutes = dayjs(new Date()).diff(dayjs(geoPos.timestamp), 'minute', true);
        if (deltaMinutes > 2) {
            accuracyColor = 'gray';
        } else if (accuracy > 1000) {
            accuracyColor = 'red';
        } else if (accuracy > 20) {
            accuracyColor = 'orange';
        }
        // console.log(
        //     'updateUserLocation',
        //     position,
        //     this.userFollow,
        //     geoPos.timestamp.valueOf(),
        //     new Date().valueOf(),
        //     // dayjs(new Date()).valueOf(),
        //     // dayjs().valueOf(),
        //     // geoPos.timestamp,
        //     // new Date(),
        //     // dayjs(new Date()),
        //     // dayjs(Date.now()),
        //     // dayjs(),
        //     deltaMinutes,
        //     accuracyColor
        // );
        if (!this.userMarker) {
            const posWithoutAltitude = { lat: position.lat, lon: position.lon };
            this.getOrCreateLocalVectorLayer();
            // const projection = this.mapView.projection;

            this.accuracyMarker = new Polygon<LatLonKeys>({
                positions: this.getCirclePoints(position),
                styleBuilder: {
                    size: 16,
                    color: new Color(70, 14, 122, 254),
                    lineStyleBuilder: {
                        color: new Color(150, 14, 122, 254),
                        width: 1
                    }
                }
            });

            this.userBackMarker = new Point<LatLonKeys>({
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 17,
                    color: '#ffffff'
                }
            });
            this.userMarker = new Point<LatLonKeys>({
                metaData: {
                    userMarker: 'true'
                },
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 14,
                    color: accuracyColor
                }
            });
            this.localBackVectorDataSource.add(this.accuracyMarker);
            this.localVectorDataSource.add(this.userBackMarker);
            this.localVectorDataSource.add(this.userMarker);
            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
        } else {
            // const currentLocation = { lat: this.lastUserLocation.latitude, lon: this.lastUserLocation.longitude, horizontalAccuracy: this.lastUserLocation.horizontalAccuracy };
            this.userMarker.color = accuracyColor;
            this.accuracyMarker.visible = accuracy > 20;
            new TWEEN.Tween(this.lastUserLocation)
                .to(position, LOCATION_ANIMATION_DURATION)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onUpdate((newPos) => {
                    if (this.userMarker) {
                        const { altitude, ...posWithoutAltitude } = newPos;
                        this.accuracyMarker.positions = this.getCirclePoints(posWithoutAltitude);
                        this.userBackMarker.position = posWithoutAltitude;
                        this.userMarker.position = posWithoutAltitude;
                    }
                })
                .start(0);

            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
            // this.accuracyMarker.positions = this.getCirclePoints(position);
        }
        if (this.userFollow) {
            this.mapView.setZoom(Math.max(this.mapView.zoom, 16), LOCATION_ANIMATION_DURATION);
            this.mapView.setFocusPos(position, LOCATION_ANIMATION_DURATION);
        }
        this.lastUserLocation = position;
    }
    onLocation(event: UserLocationdEventData) {
        if (mapStore.queryingLocation) {
            this.geoHandler.dontWatchWhilePaused = ApplicationSettings.getBoolean('stopGPSWhilePaused', true);
            this.stopWatchLocation();
            mapStore.queryingLocation = false;
        }
        // const { android, ios, ...toPrint } = data.location;
        if (DEV_LOG) {
            console.log('onLocation', this._userFollow, event.location, this.userFollow);
        }
        if (event.error) {
            console.log(event.error);
            return;
        } else if (event.location) {
            this.updateUserLocation(event.location);
        }
    }
    geoHandler: GeoHandler;
    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler && geoHandler.off(UserLocationdEvent, this.onLocation, this);
        this.geoHandler = null;
    }

    async startWatchLocation() {
        console.log('startWatchLocation', mapStore.watchingLocation, !!this.geoHandler);
        if (mapStore.watchingLocation || !this.geoHandler) {
            return;
        }
        this.userFollow = true;
        await this.geoHandler.enableLocation();
        await this.geoHandler.startWatch();
        mapStore.watchingLocation = true;
        showSnack({
            message: lc('watching_location')
        });
    }
    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        mapStore.watchingLocation = false;
        showSnack({
            message: lc('stopped_watching_location')
        });
    }
    async askUserLocation() {
        console.log('askUserLocation', !!this.geoHandler);
        this.userFollow = true;
        await this.geoHandler.enableLocation();
        mapStore.queryingLocation = true;
        this.geoHandler.dontWatchWhilePaused = false;
        this.startWatchLocation();
    }
    onWatchLocation() {
        mapStore.queryingLocation = false;
        if (!mapStore.watchingLocation) {
            this.startWatchLocation();
        } else {
            this.stopWatchLocation();
        }
    }

    mediaSession: android.support.v4.media.session.MediaSessionCompat;
    initMediaSession() {
        if (!this.mediaSession) {
            const context: android.content.Context = ad.getApplicationContext();
            const mediaSession = (this.mediaSession = new android.support.v4.media.session.MediaSessionCompat(
                context,
                'AlpiMaps'
            ));
            mediaSession.setActive(true);
            mediaSession.setFlags(
                android.support.v4.media.session.MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS |
                    android.support.v4.media.session.MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
            );
        }
    }
    public showMapAsAlbumArt() {
        if (global.isAndroid) {
            // console.log('showMapAsAlbumArt');
            // (this.mapView.android as com.carto.ui.MapView).onResume();
            this.mapView.captureRendering(false).then((result) => {
                // console.log('showMapAsAlbumArt0', result, result.android);
                const color = accentColor.android;
                // NotificationHelper.createNotificationChannel(context);
                this.initMediaSession();
                const mediaSession = this.mediaSession;
                mediaSession.setMetadata(
                    new android.support.v4.media.MediaMetadataCompat.Builder()
                        // .putBitmap(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ART, result.android)
                        .putBitmap(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ALBUM_ART, result.android)
                        .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ALBUM_ARTIST, 'test')
                        .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ALBUM, 'test')
                        .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_TITLE, 'test')
                        .build()
                );

                const pscb = new android.support.v4.media.session.PlaybackStateCompat.Builder();
                pscb.setState(android.support.v4.media.session.PlaybackStateCompat.STATE_PLAYING, 0, 0);
                mediaSession.setPlaybackState(pscb.build());
                // mediaSession.setCallback(new android.support.v4.media.session.MediaSessionCompat.Callback({

                // }));

                // console.log('showMapAsAlbumArt1', mediaSession, mediaSession.getSessionToken());
                // const activityClass = (com as any).tns.NativeScriptActivity.class;
                // const tapActionIntent = new android.content.Intent(context, activityClass);
                // tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
                // tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
                // const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);

                const context: android.content.Context = ad.getApplicationContext();
                const builder = new androidx.core.app.NotificationCompat.Builder(
                    context,
                    NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL
                );
                // construct notification in builder
                builder.setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_SECRET);
                builder.setShowWhen(false);
                // builder.setOngoing(true);
                builder.setColor(color);
                builder.setOnlyAlertOnce(true);
                // builder.setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH);
                // builder.setContentIntent(tapActionPendingIntent);
                builder.setSmallIcon(ad.resources.getDrawableId('ic_stat_logo'));
                builder.setContentTitle('Alpi Maps Song test!');
                // console.log('showMapAsAlbumArt2');
                builder.setStyle(
                    new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(mediaSession.getSessionToken())
                );
                // console.log('showMapAsAlbumArt3');
                const notifiction = builder.build();
                const service = context.getSystemService(
                    android.content.Context.NOTIFICATION_SERVICE
                ) as android.app.NotificationManager;
                service.notify(SCREENSHOT_NOTIFICATION_ID, notifiction);
            });
        }
    }

    public hideScreenshotNotification() {
        if (global.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const service = context.getSystemService(
                android.content.Context.NOTIFICATION_SERVICE
            ) as android.app.NotificationManager;
            service.cancel(SCREENSHOT_NOTIFICATION_ID);
        }
    }
}
