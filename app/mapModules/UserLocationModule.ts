import { GeoLocation } from 'nativescript-gps';
import { MapPos, MapPosVector } from 'nativescript-carto/core/core';
import { VectorLayer } from 'nativescript-carto/layers/vector';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { LineStyleBuilder } from 'nativescript-carto/vectorelements/line';
import { Point, PointStyleBuilder } from 'nativescript-carto/vectorelements/point';
import { Polygon, PolygonStyleBuilder } from 'nativescript-carto/vectorelements/polygon';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { Color } from 'tns-core-modules/color/color';
import * as Animation from '~/animation';
import Map from '~/components/Map';
import { GeoHandler, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import MapModule from './MapModule';
import { ad, layout } from 'tns-core-modules/utils/utils';
// import dayjs from 'dayjs';
import moment from 'moment';
import { EARTH_RADIUS } from '~/utils/geo';
import { NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL } from '~/services/android/NotifcationHelper';
import { showSnack } from 'nativescript-material-snackbar';

const LOCATION_ANIMATION_DURATION = 300;
const SCREENSHOT_NOTIFICATION_ID = 23466571;

export default class UserLocationModule extends MapModule {
    localVectorDataSource: LocalVectorDataSource;
    localVectorLayer: VectorLayer;
    userBackMarker: Point;
    userMarker: Point;
    accuracyMarker: Polygon;
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

    onMapReady(mapComp: Map, mapView: CartoMap) {
        super.onMapReady(mapComp, mapView);
        // this.log('onMapReady', this._userFollow);
    }
    onMapDestroyed() {
        super.onMapDestroyed();
        this.localVectorLayer = null;
        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
    }

    getCirclePoints(loc: Partial<MapPos & { horizontalAccuracy: number }>) {
        const centerLat = loc.lat;
        const centerLon = loc.lon;
        const radius = loc.horizontalAccuracy;
        const N = Math.min(radius * 8, 100);

        const points = new MapPosVector();

        for (let i = 0; i <= N; i++) {
            const angle = (Math.PI * 2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat = centerLat + (180 / Math.PI) * (dy / EARTH_RADIUS);
            const lon = centerLon + ((180 / Math.PI) * (dx / EARTH_RADIUS)) / Math.cos((centerLat * Math.PI) / 180);
            points.add({ lat, lon });
        }

        return points;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapView.projection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            this.localVectorLayer = new VectorLayer({ visibleZoomRange: [0, 24], dataSource: this.localVectorDataSource });

            // always add it at 1 to respect local order
            this.mapComp.addLayer(this.localVectorLayer, 'userLocation');
        }
    }
    onMapMove(e) {
        this.userFollow = !e.data.userAction;
    }
    public mLastUserLocation: MapPos & { horizontalAccuracy: number; verticalAccuracy: number; altitude: number; speed: number } = null;
    get lastUserLocation() {
        return this.mLastUserLocation;
    }
    set lastUserLocation(value) {
        this.mLastUserLocation = value;
        this.notify({
            eventName: 'location',
            object: this,
            data: value
        });
        if (gVars.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const myKM = context.getSystemService(android.content.Context.KEYGUARD_SERVICE) as android.app.KeyguardManager;
            const locked = myKM.inKeyguardRestrictedInputMode();
            // this.log('onNewLocation', locked);
            if (locked) {
                // it is locked
                this.showMapAsAlbumArt();
            } else {
                // it is not locked
                this.hideScreenshotNotification();
            }
        }
    }

    updateUserLocation(geoPos: GeoLocation) {
        const position = {
            lat: geoPos.latitude,
            lon: geoPos.longitude,
            altitude: geoPos.altitude,
            horizontalAccuracy: geoPos.horizontalAccuracy,
            verticalAccuracy: geoPos.verticalAccuracy,
            speed: geoPos.speed
        };
        if (
            !this.mapView ||
            (this.lastUserLocation &&
                this.lastUserLocation.lat === geoPos.latitude &&
                this.lastUserLocation.lon === geoPos.longitude &&
                this.lastUserLocation.horizontalAccuracy === geoPos.horizontalAccuracy)
        ) {
            return;
        }

        // if (!!this.userFollow) {
        //     this.mapView.focusPos = position;
        //     this.mapView.zoom = 16;
        // }
        let accuracyColor = '#0e7afe';
        const deltaMinutes = moment(new Date()).diff(moment(geoPos.timestamp), 'minute', true);
        if (deltaMinutes > 2) {
            accuracyColor = 'gray';
        } else {
            const accuracy = geoPos.horizontalAccuracy || 0;
            if (accuracy > 1000) {
                accuracyColor = 'red';
            } else if (accuracy > 10) {
                accuracyColor = 'orange';
            }
        }
        // this.log(
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

            this.accuracyMarker = new Polygon({
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

            this.userBackMarker = new Point({
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 17,
                    color: '#ffffff'
                }
            });
            this.userMarker = new Point({
                position: posWithoutAltitude,
                styleBuilder: {
                    size: 14,
                    color: accuracyColor
                }
            });
            this.localVectorDataSource.add(this.accuracyMarker);
            this.localVectorDataSource.add(this.userBackMarker);
            this.localVectorDataSource.add(this.userMarker);
            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
        } else {
            // const currentLocation = { lat: this.lastUserLocation.latitude, lon: this.lastUserLocation.longitude, horizontalAccuracy: this.lastUserLocation.horizontalAccuracy };
            new Animation.Animation(this.lastUserLocation)
                .to(position, LOCATION_ANIMATION_DURATION)
                .easing(Animation.Easing.Quadratic.Out)
                .onUpdate(newPos => {
                    if (this.userMarker) {
                        const { altitude, ...posWithoutAltitude } = newPos;
                        this.accuracyMarker.positions = this.getCirclePoints(posWithoutAltitude);
                        this.userBackMarker.position = posWithoutAltitude;
                        this.userMarker.position = posWithoutAltitude;
                        this.userMarker.styleBuilder.color = accuracyColor;
                        this.userMarker.styleBuilder = this.userMarker.styleBuilder;
                    }
                })
                .start();

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
    onLocation(data: UserLocationdEventData) {
        this.queryingLocation = false;
        // const { android, ios, ...toPrint } = data.location;
        // this.log('onLocation', this._userFollow, toPrint, this.userFollow);
        if (data.error) {
            this.log(data.error);
            return;
        }
        this.updateUserLocation(data.location);
    }
    geoHandler: GeoHandler;
    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler.off(UserLocationdEvent, this.onLocation, this);
        this.geoHandler = null;
    }

    startWatchLocation() {
        // console.log('startWatchLocation');
        if (this.watchingLocation) {
            return;
        }
        this.userFollow = true;
        return this.geoHandler
            .enableLocation()
            .then(r => this.geoHandler.startWatch())
            .then(() => {
                this.watchingLocation = true;
                showSnack({
                    message: this.mapComp.$tc('watching_location'),
                });
                // console.log('started watching location');
            });
    }
    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        this.watchingLocation = false;
        showSnack({
            message: this.mapComp.$tc('stopped_watching_location')
        });
    }
    askUserLocation() {
        this.userFollow = true;

        return this.geoHandler.enableLocation().then(() => {
            this.queryingLocation = true;
            this.geoHandler.getLocation();
        });
    }
    watchingLocation = false;
    queryingLocation = false;
    onWatchLocation() {
        if (!this.watchingLocation) {
            this.startWatchLocation();
        } else {
            this.stopWatchLocation();
        }
    }

    mediaSession: android.support.v4.media.session.MediaSessionCompat;
    initMediaSession() {
        if (!this.mediaSession) {
            const context: android.content.Context = ad.getApplicationContext();
            const mediaSession = (this.mediaSession = new android.support.v4.media.session.MediaSessionCompat(context, 'AlpiMaps'));
            mediaSession.setActive(true);
            mediaSession.setFlags(android.support.v4.media.session.MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS | android.support.v4.media.session.MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS);
        }
    }
    public showMapAsAlbumArt() {
        if (gVars.isAndroid) {
            // this.log('showMapAsAlbumArt');
            // (this.mapView.android as com.carto.ui.MapView).onResume();
            this.mapView.captureRendering(false).then(result => {
                // this.log('showMapAsAlbumArt0', result, result.android);
                const color = android.graphics.Color.parseColor(this.mapComp.accentColor);
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

                // this.log('showMapAsAlbumArt1', mediaSession, mediaSession.getSessionToken());
                // const activityClass = (com as any).tns.NativeScriptActivity.class;
                // const tapActionIntent = new android.content.Intent(context, activityClass);
                // tapActionIntent.setAction(android.content.Intent.ACTION_MAIN);
                // tapActionIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER);
                // const tapActionPendingIntent = android.app.PendingIntent.getActivity(context, 10, tapActionIntent, 0);

                const context: android.content.Context = ad.getApplicationContext();
                const builder = new androidx.core.app.NotificationCompat.Builder(context, NOTIFICATION_CHANEL_ID_SCREENSHOT_CHANNEL);
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
                // this.log('showMapAsAlbumArt2');
                builder.setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(mediaSession.getSessionToken()));
                // this.log('showMapAsAlbumArt3');
                const notifiction = builder.build();
                const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
                service.notify(SCREENSHOT_NOTIFICATION_ID, notifiction);
            });
        }
    }

    public hideScreenshotNotification() {
        if (gVars.isAndroid) {
            const context: android.content.Context = ad.getApplicationContext();
            const service = context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager;
            service.cancel(SCREENSHOT_NOTIFICATION_ID);
        }
    }
}
