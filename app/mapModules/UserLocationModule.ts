import { lc } from '@nativescript-community/l';
import { MapPos, MapPosVector, fromNativeMapPos, fromNativeScreenPos, toNativeScreenPos } from '@nativescript-community/ui-massifmaps/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-massifmaps/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-massifmaps/layers/vector';
import { Marker } from '@nativescript-community/ui-massifmaps/vectorelements/marker';
import { BillboardOrientation, BillboardScaling } from '@nativescript-community/ui-massifmaps/vectorelements';
import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { Polygon } from '@nativescript-community/ui-massifmaps/vectorelements/polygon';
import { Tween } from '@nativescript-community/ui-chart/animation/Tween';
import { showSnack } from '~/utils/ui';
import { ApplicationSettings, Color, ImageSource, Utils } from '@nativescript/core';
import dayjs from 'dayjs';
import { get, writable } from 'svelte/store';
import { GeoHandler, GeoLocation, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import { getBGServiceInstance } from '~/services/BgService';
import { packageService } from '~/services/PackageService';
import { queryingLocation, watchingLocation } from '~/stores/mapStore';
import { EARTH_RADIUS, PI_X2, TO_DEG, TO_RAD } from '~/utils/geo';
import { requestScreenRefresh } from '~/utils/screen';
import MapModule, { getMapContext } from './MapModule';
import { MapInteractionInfo } from '@nativescript-community/ui-massifmaps/ui';
import {
    DEFAULT_NAVIGATION_ARROW_MARKER,
    DEFAULT_NAVIGATION_POSITION_OFFSET,
    DEFAULT_NAVIGATION_TILT,
    SETTINGS_NAVIGATION_ARROW_MARKER,
    SETTINGS_NAVIGATION_POSITION_OFFSET,
    SETTINGS_NAVIGATION_TILT
} from '~/utils/constants';
import { colors, screenHeightDips } from '~/variables';
import { request } from '@nativescript-community/perms';
import { CLog } from '@nativescript-community/sentry';
import { isNavigating } from '~/stores/navigationStore';

const LOCATION_ANIMATION_DURATION = 300;
/** pixels of the generated marker bitmaps: big enough to stay clean when carto scales them */
const USER_BITMAP_SIZE = 96;
/** screen size of the heading arrow, and of the plain dot with its ring */
const ARROW_MARKER_SIZE = 30;
const DOT_MARKER_SIZE = 20;

/** what the user's position looks like: a heading chevron while navigating, a ringed dot otherwise */
type UserMarkerKind = 'arrow' | 'dot';

const userBitmaps: { [key: string]: ImageSource } = {};
/**
 * The marker image, drawn into an offscreen canvas rather than shipped as an asset so it follows the
 * theme colors and needs no extra image files. One per look, cached: the dot's colour follows the fix
 * accuracy, so there are a handful of them.
 *
 * Android gets a *copy* every time, and never the cached image itself: carto's `getMassifBitmap`
 * recycles the android bitmap it is handed (see `@nativescript-community/ui-massifmaps/index.android`).
 * Handing it the cached one recycles a bitmap the offscreen Canvas still owns — leaving the cache
 * pointing at a recycled bitmap for the next marker, and the canvas free to release it a second time.
 */
function getUserBitmap(kind: UserMarkerKind, color: string, outlineColor: string) {
    const key = `${kind}|${color}|${outlineColor}`;
    let bitmap = userBitmaps[key];
    if (!bitmap) {
        const size = USER_BITMAP_SIZE;
        const canvas = new Canvas(size, size);
        const paint = new Paint();
        if (kind === 'arrow') {
            const path = new Path();
            // a chevron pointing up, notched at the bottom so the direction is unambiguous
            path.moveTo(size * 0.5, size * 0.08);
            path.lineTo(size * 0.9, size * 0.92);
            path.lineTo(size * 0.5, size * 0.7);
            path.lineTo(size * 0.1, size * 0.92);
            path.close();
            paint.setStyle(Style.FILL);
            paint.setColor(color);
            canvas.drawPath(path, paint);
            paint.setStyle(Style.STROKE);
            paint.setStrokeWidth(size * 0.06);
            paint.setColor(outlineColor);
            canvas.drawPath(path, paint);
        } else {
            // the ring is part of the image: it used to be a second marker underneath this one
            paint.setStyle(Style.FILL);
            paint.setColor(outlineColor);
            canvas.drawCircle(size / 2, size / 2, size * 0.42, paint);
            paint.setColor(color);
            canvas.drawCircle(size / 2, size / 2, size * 0.32, paint);
        }
        bitmap = new ImageSource(canvas.getImage());
        userBitmaps[key] = bitmap;
    }
    if (__ANDROID__) {
        return new ImageSource(android.graphics.Bitmap.createBitmap(bitmap.android));
    }
    return bitmap;
}

export const navigationModeStore = writable(false);
/** whether the camera is still following the user: panning the map turns it off */
export const userFollowStore = writable(false);

// const NOTIFICATION_SERVICE = android.content.Context.NOTIFICATION_SERVICE;

const mapContext = getMapContext();

export default class UserLocationModule extends MapModule {
    localBackVectorDataSource: LocalVectorDataSource;
    localVectorDataSource: LocalVectorDataSource;
    localBackVectorLayer: VectorLayer;
    localVectorLayer: VectorLayer;
    /**
     * One marker for both modes. The heading arrow and the dot used to be three separate elements kept
     * in sync by showing and hiding each other, which meant every mode change had to remember to touch
     * all of them — and a marker whose look depended on a fix that had not arrived yet simply stayed
     * wrong. Now the look is a style swapped on the single marker, so there is nothing to keep in sync.
     */
    userMarker: Marker<LatLonKeys>;
    /** which look the marker currently wears, so the style is only rebuilt when it actually changes */
    private userMarkerStyleKey: string = null;
    /** the halo stays its own element: it is a ground circle in meters, not a screen sized billboard */
    accuracyMarker: Polygon<LatLonKeys>;
    /** last heading we were given, so a fix without one does not swing the arrow back to north */
    private lastKnownBearing = 0;
    mUserFollow = false;
    get userFollow() {
        return this.mUserFollow;
    }
    set userFollow(value: boolean) {
        if (value !== this.mUserFollow) {
            this.mUserFollow = value;
            userFollowStore.set(value);
            // if (!value) {
            //     this.navigationMode = false;
            // }
        }
    }
    get navigationMode() {
        return get(navigationModeStore);
    }
    set navigationMode(value: boolean) {
        navigationModeStore.set(value);
        // redraw now rather than on the next fix, whichever way we are going: entering navigation is
        // the moment the user looks at the marker, and a fix can be seconds away — or never, since an
        // unchanged position is dropped before it reaches the markers
        if (this.mLastUserLocation) {
            this.updateMarkers(this.mLastUserLocation);
        }
        if (value) {
            this.userFollow = true;
            this.moveToUserLocation();
        }
    }

    override onMapDestroyed() {
        super.onMapDestroyed();
        this.localVectorLayer = null;
        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
        // the elements belonged to that data source: kept around, the next `updateMarkers` would update
        // markers attached to nothing and never add them to the layer the new map builds
        this.userMarker = null;
        this.userMarkerStyleKey = null;
        this.accuracyMarker = null;
    }

    getCirclePoints(loc: Partial<MapPos<LatLonKeys> & { horizontalAccuracy: number }>) {
        const centerLat = loc.lat;
        const centerLon = loc.lon;
        const radius = loc.horizontalAccuracy;
        const N = Math.min(radius * 8, 100);

        const points = new MapPosVector<LatLonKeys>();

        for (let i = 0; i <= N; i++) {
            const angle = (PI_X2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat = centerLat + TO_DEG * (dy / EARTH_RADIUS);
            const lon = centerLon + (TO_DEG * (dx / EARTH_RADIUS)) / Math.cos(centerLat * TO_RAD);
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
    override onMapInteraction(e: { data: MapInteractionInfo }) {
        const interaction = e.data.interaction;
        // DEV_LOG && console.log('onMapInteraction', interaction);
        if (!interaction.isZoomAction && interaction.isPanAction && e.data.userAction) {
            this.userFollow = false;
        }
    }
    public mLastUserLocation: GeoLocation = null;
    get lastUserLocation() {
        return this.mLastUserLocation;
    }
    set lastUserLocation(value) {
        this.mLastUserLocation = value;
        if (value) {
            this.notify({
                eventName: 'location',
                object: this,
                data: value
            });
        }
    }

    async updateUserLocation(geoPos: GeoLocation) {
        if (!geoPos) {
            return;
        }
        const position = {
            ...geoPos
        };
        // the heading is part of what the marker draws, so a fix that only turned is not "the same fix"
        if (
            !this.mapView ||
            (this.lastUserLocation &&
                this.lastUserLocation.lat === geoPos.lat &&
                this.lastUserLocation.lon === geoPos.lon &&
                this.lastUserLocation.horizontalAccuracy === geoPos.horizontalAccuracy &&
                this.lastUserLocation.bearing === geoPos.bearing)
        ) {
            if (this.userFollow) {
                this.moveToUserLocation();
            }
            return;
        }

        const altitude = await packageService.getElevation(geoPos);
        if (altitude !== null) {
            position.altitude = Math.round(altitude);
        }
        // DEV_LOG && console.log('updateUserLocation', JSON.stringify(geoPos));
        this.updateMarkers(position);
        this.lastUserLocation = position;
        const inBackground = getBGServiceInstance().appInBackground;
        if (this.userFollow) {
            this.moveToUserLocation(inBackground ? 0 : undefined);
        }
        if (__ANDROID__ && inBackground && !get(isNavigating)) {
            const a9ScreenRefresh = ApplicationSettings.getBoolean('a9_background_location_screenrefresh', false);
            if (a9ScreenRefresh) {
                requestScreenRefresh(this.geoHandler);
            }
        }
    }

    /**
     * Everything drawn at the user's position, split out so entering navigation can redraw it at once.
     *
     * The marker is one element wearing one of two looks. Which look it wears follows the mode alone,
     * not the mode *and* whether this particular fix happened to carry a heading: the arrow used to
     * wait for a fix with a bearing, so starting navigation while standing still left the dot on screen.
     */
    private updateMarkers(position: GeoLocation) {
        let accuracyColor = '#0e7afe';
        let accuracySize = DOT_MARKER_SIZE;
        const accuracy = position.horizontalAccuracy || 0;
        if (position.age > 120000) {
            accuracyColor = 'gray';
        } else if (accuracy > 1000) {
            accuracySize = 12;
            accuracyColor = 'red';
        } else if (accuracy > 20) {
            accuracySize = 16;
            accuracyColor = 'orange';
        }
        if (position.bearing >= 0) {
            this.lastKnownBearing = position.bearing;
        }

        const useArrow = this.navigationMode && ApplicationSettings.getBoolean(SETTINGS_NAVIGATION_ARROW_MARKER, DEFAULT_NAVIGATION_ARROW_MARKER);
        const accuracyMarkerEnabled = ApplicationSettings.getBoolean('show_accuracy_marker', true);
        const newPos = { lat: position.lat, lon: position.lon };
        this.getOrCreateLocalVectorLayer();

        if (accuracyMarkerEnabled) {
            if (!this.accuracyMarker) {
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
                this.localBackVectorDataSource.add(this.accuracyMarker);
            } else {
                this.accuracyMarker.positions = this.getCirclePoints(position);
            }
            // the halo belongs to the dot: around the arrow it just draws a circle that never goes away
            this.accuracyMarker.visible = !useArrow && accuracy > 20;
        }

        const { colorOnPrimary, colorPrimary } = get(colors);
        const kind: UserMarkerKind = useArrow ? 'arrow' : 'dot';
        const color = useArrow ? colorPrimary : accuracyColor;
        // with a halo to say how good the fix is, the dot itself can keep one size
        const size = useArrow ? ARROW_MARKER_SIZE : accuracyMarkerEnabled ? DOT_MARKER_SIZE : accuracySize;
        const styleKey = `${kind}|${color}|${size}`;
        if (!this.userMarker) {
            this.userMarker = new Marker<LatLonKeys>({
                metaData: {
                    userMarker: 'true'
                },
                position: newPos,
                styleBuilder: this.userMarkerStyle(kind, color, size, colorOnPrimary)
            });
            this.localVectorDataSource.add(this.userMarker);
        } else if (styleKey !== this.userMarkerStyleKey) {
            // rebuilding a style means rebuilding its bitmap, so only ever on a real change of look
            this.userMarker.styleBuilder = this.userMarkerStyle(kind, color, size, colorOnPrimary);
        }
        this.userMarkerStyleKey = styleKey;
        this.userMarker.position = newPos;
        // the dot has no heading to show, and a chevron pointing north while the map points elsewhere
        // is worse than one holding the last direction we were actually given
        this.userMarker.rotation = useArrow ? -this.lastKnownBearing : 0;
        this.userMarker.visible = true;
    }

    private userMarkerStyle(kind: UserMarkerKind, color: string, size: number, outlineColor: string) {
        return {
            size,
            bitmap: getUserBitmap(kind, color, outlineColor),
            // carto anchors a marker at (0, -1) — its bottom edge — because a marker is usually a pin
            // whose tip points at the place. This one *is* the place, so it is centred on it instead:
            // left as it was, the whole marker sat half its own height north of the actual fix
            anchorPointX: 0,
            anchorPointY: 0,
            // GROUND so the chevron turns with the map rather than staying upright on screen
            orientationMode: BillboardOrientation.GROUND,
            scalingMode: BillboardScaling.CONST_SCREEN_SIZE
        };
    }
    /** set by NavigationService while navigating: the speed/maneuver derived zoom to hold */
    navigationZoom = 0;

    moveToUserLocation(duration = LOCATION_ANIMATION_DURATION) {
        if (!this.mLastUserLocation) {
            return;
        }
        if (this.navigationZoom > 0) {
            this.mapView.setZoom(this.navigationZoom, duration);
        } else {
            this.mapView.setZoom(Math.max(this.mapView.zoom, 10), duration);
        }
        if (this.navigationMode) {
            const options = mapContext.getMap().getOptions();
            options.setFocusPointOffset(
                toNativeScreenPos({
                    x: mapContext.focusOffset.x,
                    y: mapContext.focusOffset.y - Utils.layout.toDevicePixels(screenHeightDips) * ApplicationSettings.getNumber(SETTINGS_NAVIGATION_POSITION_OFFSET, DEFAULT_NAVIGATION_POSITION_OFFSET)
                })
            );
            this.mapView.setFocusPos(this.mLastUserLocation, duration);

            this.mapView.setBearing(-this.mLastUserLocation.bearing, duration);
            const tilt = ApplicationSettings.getNumber(SETTINGS_NAVIGATION_TILT, DEFAULT_NAVIGATION_TILT);
            if (tilt > 0) {
                this.mapView.setTilt(tilt, duration);
            }
        } else {
            this.mapView.setFocusPos(this.mLastUserLocation, duration);
        }
    }
    onLocation(event: UserLocationdEventData) {
        // const { android, ios, ...toPrint } = data.location;
        // DEV_LOG && console.log('onLocation', this.mUserFollow, event.location);
        if (event.error) {
            this.stopWatchLocation();
            showSnack({
                message: lc('location_error', event.error.toString())
            });
            console.error(event.error, event.error.stack);
            return;
        } else if (event.location) {
            if (get(queryingLocation) && event.location.horizontalAccuracy <= 20 && event.location.age < 10000) {
                this.stopWatchLocation();
            }
            this.updateUserLocation(event.location);
        }
    }
    geoHandler: GeoHandler;
    onServiceLoaded(geoHandler: GeoHandler) {
        this.geoHandler = geoHandler;
        this.updateUserLocation(geoHandler.getLastKnownLocation());
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler && geoHandler.off(UserLocationdEvent, this.onLocation, this);
        this.geoHandler = null;
    }

    /**
     * @param force restart even when already watching, for callers that just changed the watch
     * options and need them applied. Without it they had to call startWatch a second time themselves.
     */
    async startWatchLocation({ force = false, opts = {} } = {}) {
        if (!this.geoHandler || (get(watchingLocation) && !force)) {
            return;
        }
        if (__ANDROID__ && !this.geoHandler.stopGpsBackground) {
            await request('notification');
        }
        await this.geoHandler.enableLocation();
        await this.geoHandler.startWatch(opts);
        this.userFollow = true;
        watchingLocation.set(true);
        if (!get(queryingLocation)) {
            showSnack({
                hideDelay: 1,
                message: lc('watching_location')
            });
        }
    }
    /**
     * Puts the location stores back in step with the watch actually running. Navigation drives the
     * watch directly, so without this the button can end up saying the opposite of what the gps does.
     */
    syncWatchingState() {
        const watching = !!this.geoHandler?.isWatching();
        if (get(watchingLocation) !== watching) {
            watchingLocation.set(watching);
        }
        if (!watching) {
            queryingLocation.set(false);
            this.userFollow = false;
        }
    }

    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        watchingLocation.set(false);
        queryingLocation.set(false);
        this.userFollow = false;
        //  if (!queryingLocation) {
        //     showSnack({
        //         message: lc('stopped_watching_location')
        //      });
        //   }
    }
    async askUserLocation() {
        await this.geoHandler.enableLocation();

        if (!get(watchingLocation)) {
            queryingLocation.set(true);
            this.startWatchLocation();
        } else {
            this.userFollow = true;
            this.moveToUserLocation();
        }
    }
    onWatchLocation() {
        queryingLocation.set(false);
        if (!get(watchingLocation)) {
            this.startWatchLocation();
        } else {
            this.stopWatchLocation();
        }
    }
}
