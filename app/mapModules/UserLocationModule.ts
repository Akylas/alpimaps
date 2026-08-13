import { lc } from '@nativescript-community/l';
import { MapPos, MapPosVector, fromNativeMapPos, fromNativeScreenPos, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Marker } from '@nativescript-community/ui-carto/vectorelements/marker';
import { BillboardOrientation, BillboardScaling } from '@nativescript-community/ui-carto/vectorelements';
import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
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
import { MapInteractionInfo } from '@nativescript-community/ui-carto/ui';
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

const LOCATION_ANIMATION_DURATION = 300;
/** pixels of the generated arrow bitmap: big enough to stay clean when carto scales it */
const ARROW_BITMAP_SIZE = 96;

let arrowBitmap;
/**
 * The heading arrow other navigation apps show instead of a dot. Drawn once into an offscreen canvas
 * rather than shipped as an asset, so it follows the theme colors and needs no extra image files.
 */
function getArrowBitmap(color: string, outlineColor: string) {
    if (!arrowBitmap) {
        const canvas = new Canvas(ARROW_BITMAP_SIZE, ARROW_BITMAP_SIZE);
        const size = ARROW_BITMAP_SIZE;
        const path = new Path();
        // a chevron pointing up, notched at the bottom so the direction is unambiguous
        path.moveTo(size * 0.5, size * 0.08);
        path.lineTo(size * 0.9, size * 0.92);
        path.lineTo(size * 0.5, size * 0.7);
        path.lineTo(size * 0.1, size * 0.92);
        path.close();

        const paint = new Paint();
        paint.setStyle(Style.FILL);
        paint.setColor(color);
        canvas.drawPath(path, paint);
        paint.setStyle(Style.STROKE);
        paint.setStrokeWidth(size * 0.06);
        paint.setColor(outlineColor);
        canvas.drawPath(path, paint);
        arrowBitmap = new ImageSource(canvas.getImage());
    }
    return arrowBitmap;
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
    userBackMarker: Point<LatLonKeys>;
    userMarker: Point<LatLonKeys>;
    accuracyMarker: Polygon<LatLonKeys>;
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
        if (value) {
            this.userFollow = true;
            // draw the arrow now rather than on the next fix: entering navigation is the moment the
            // user looks at the marker, and a fix can be seconds away — or, if the position has not
            // moved, never, since an identical fix is dropped before it reaches the markers
            if (this.mLastUserLocation) {
                this.updateMarkers(this.mLastUserLocation);
            }
            this.moveToUserLocation();
        } else {
            // the arrow hid the dot; without this it stays hidden until the next fix arrives, and if
            // the watch just stopped that never happens, leaving only the white halo on the map
            this.showArrowMarker(false);
        }
    }

    /** Swaps between the heading arrow and the plain dot, keeping exactly one of them visible. */
    private showArrowMarker(useArrow: boolean) {
        if (this.userArrowMarker) {
            this.userArrowMarker.visible = useArrow;
        }
        if (this.userMarker) {
            this.userMarker.visible = !useArrow;
        }
        if (this.userBackMarker) {
            this.userBackMarker.visible = !useArrow;
        }
        if (this.accuracyMarker && useArrow) {
            // the halo belongs to the dot: left on, it draws a circle around the arrow for ever
            this.accuracyMarker.visible = false;
        }
    }
    override onMapDestroyed() {
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
        if (
            !this.mapView ||
            (this.lastUserLocation && this.lastUserLocation.lat === geoPos.lat && this.lastUserLocation.lon === geoPos.lon && this.lastUserLocation.horizontalAccuracy === geoPos.horizontalAccuracy)
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
        if (__ANDROID__ && inBackground) {
            const a9ScreenRefresh = ApplicationSettings.getBoolean('a9_background_location_screenrefresh', false);
            if (a9ScreenRefresh) {
                requestScreenRefresh(this.geoHandler);
            }
        }
    }

    /** Everything drawn at the user's position, split out so entering navigation can redraw it at once. */
    private updateMarkers(position: GeoLocation) {
        let accuracyColor = '#0e7afe';
        let accuracySize = 14;
        const accuracy = position.horizontalAccuracy || 0;
        if (position.age > 120000) {
            accuracyColor = 'gray';
        } else if (accuracy > 1000) {
            accuracySize = 8;
            accuracyColor = 'red';
        } else if (accuracy > 20) {
            accuracySize = 11;
            accuracyColor = 'orange';
        }

        const useArrow = this.navigationMode && ApplicationSettings.getBoolean(SETTINGS_NAVIGATION_ARROW_MARKER, DEFAULT_NAVIGATION_ARROW_MARKER) && position.bearing >= 0;
        const newPos = { lat: position.lat, lon: position.lon };
        if (!useArrow) {
            if (!this.userMarker) {
                this.getOrCreateLocalVectorLayer();
                const accuracyMarkerEnabled = ApplicationSettings.getBoolean('show_accuracy_marker', true);
                if (accuracyMarkerEnabled) {
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
                }

                this.userBackMarker = new Point<LatLonKeys>({
                    position: newPos,
                    styleBuilder: {
                        size: 17,
                        color: '#ffffff'
                    }
                });
                this.userMarker = new Point<LatLonKeys>({
                    metaData: {
                        userMarker: 'true'
                    },
                    position: newPos,
                    styleBuilder: {
                        size: accuracyMarkerEnabled ? 14 : accuracySize,
                        color: accuracyColor
                    }
                });
                this.localVectorDataSource.add(this.userBackMarker);
                this.localVectorDataSource.add(this.userMarker);
            } else {
                this.userMarker.color = accuracyColor;
                const newPos = { lat: position.lat, lon: position.lon };

                this.userBackMarker.position = newPos;
                this.userMarker.position = newPos;
                if (this.accuracyMarker) {
                    this.accuracyMarker.positions = this.getCirclePoints(newPos);
                    this.accuracyMarker.visible = accuracy > 20;
                } else {
                    this.userMarker.size = accuracySize;
                }
            }
        } else {
            if (!this.userArrowMarker) {
                this.getOrCreateLocalVectorLayer();
                const { colorOnPrimary, colorPrimary } = get(colors);
                this.userArrowMarker = new Marker<LatLonKeys>({
                    position: newPos,
                    styleBuilder: {
                        size: 30,
                        bitmap: getArrowBitmap(colorPrimary, colorOnPrimary),
                        orientationMode: BillboardOrientation.GROUND,
                        scalingMode: BillboardScaling.CONST_SCREEN_SIZE
                    }
                });
                this.localVectorDataSource.add(this.userArrowMarker);
            } else {
                this.userArrowMarker.position = newPos;
                this.userArrowMarker.visible = true;
            }
            this.userArrowMarker.rotation = -position.bearing;
        }

        this.showArrowMarker(useArrow);
    }
    /** set by NavigationService while navigating: the speed/maneuver derived zoom to hold */
    navigationZoom = 0;
    userArrowMarker: Marker<LatLonKeys>;

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
