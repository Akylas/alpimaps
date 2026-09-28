import { lc } from '@nativescript-community/l';
import type * as api from '@nativescript-community/ui-massifmaps/api';
import type { MassifLayer, MassifObject, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { Canvas, Paint, Path, Style } from '@nativescript-community/ui-canvas';
import { Tween } from '@nativescript-community/ui-chart/animation/Tween';
import { showSnack } from '~/utils/ui';
import { ApplicationSettings, Color, ImageSource, Utils, knownFolders, path } from '@nativescript/core';
import dayjs from 'dayjs';
import { get, writable } from 'svelte/store';
import { GeoHandler, GeoLocation, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import { getBGServiceInstance } from '~/services/BgService';
import { packageService } from '~/services/PackageService';
import { queryingLocation, watchingLocation } from '~/stores/mapStore';
import { EARTH_RADIUS, type MapPos, PI_X2, TO_DEG, TO_RAD, toPosition } from '~/utils/geo';
import { requestScreenRefresh } from '~/utils/screen';
import MapModule, { type MapInteraction, getMapContext } from './MapModule';
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
const ARROW_MARKER_SIZE = 30;
const DOT_MARKER_SIZE = 20;

type UserMarkerKind = 'arrow' | 'dot';

const userBitmapUrls: { [key: string]: string } = {};
/**
 * Written to a file and passed as a url: `create` serialises the spec as JSON, so an `ImageSource`
 * put straight in it stringifies to nothing and the marker falls back to carto's default pin.
 */
function getUserBitmapUrl(kind: UserMarkerKind, color: string, outlineColor: string) {
    const key = `${kind}|${color}|${outlineColor}`;
    let url = userBitmapUrls[key];
    if (!url) {
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
            paint.setStyle(Style.FILL);
            paint.setColor(outlineColor);
            canvas.drawCircle(size / 2, size / 2, size * 0.42, paint);
            paint.setColor(color);
            canvas.drawCircle(size / 2, size / 2, size * 0.32, paint);
        }
        // a name per look, so the file is written once and reused across launches
        const filePath = path.join(knownFolders.temp().path, `userLocation.${kind}.${new Color(color).hex.slice(1)}.${new Color(outlineColor).hex.slice(1)}.png`);
        new ImageSource(canvas.getImage()).saveToFile(filePath, 'png');
        // `file://`: URLFileLoader rejects a bare path as an unsupported schema
        url = `file://${filePath}`;
        userBitmapUrls[key] = url;
    }
    return url;
}

export const navigationModeStore = writable(false);
/** whether the camera is still following the user: panning the map turns it off */
export const userFollowStore = writable(false);

// const NOTIFICATION_SERVICE = android.content.Context.NOTIFICATION_SERVICE;

const mapContext = getMapContext();

export default class UserLocationModule extends MapModule {
    localBackVectorDataSource: MassifSource<'massif::LocalVectorDataSource'>;
    localVectorDataSource: MassifSource<'massif::LocalVectorDataSource'>;
    localBackVectorLayer: MassifLayer<'massif::VectorLayer'>;
    localVectorLayer: MassifLayer<'massif::VectorLayer'>;
    userMarker: MassifObject<'massif::Marker'>;
    private userMarkerStyleKey: string = null;
    /** the halo stays its own element: it is a ground circle in meters, not a screen sized billboard */
    accuracyMarker: MassifObject<'massif::Polygon'>;
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
        // redraw now: an unchanged position is dropped before it reaches the markers, so the next fix may never come
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
        // `valid` first: on an activity destroy the map released what it owned before the modules
        // are told, so the handle is already gone and the call would throw out of teardown
        if (this.localVectorDataSource?.valid) {
            this.localVectorDataSource.call('clear');
        }
        this.localVectorDataSource = null;
        // the elements belonged to that data source: kept around, the next `updateMarkers` would update
        // markers attached to nothing and never add them to the layer the new map builds
        this.userMarker = null;
        this.userMarkerStyleKey = null;
        this.accuracyMarker = null;
    }

    getCirclePoints(loc: Partial<MapPos & { horizontalAccuracy: number }>) {
        const centerLat = loc.lat;
        const centerLon = loc.lon;
        const radius = loc.horizontalAccuracy;
        const N = Math.min(radius * 8, 100);

        // `[lng, lat]` pairs, which is what an element spec's `poses` takes
        const points: [number, number][] = [];
        for (let i = 0; i <= N; i++) {
            const angle = (PI_X2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const lat = centerLat + TO_DEG * (dy / EARTH_RADIUS);
            const lon = centerLon + (TO_DEG * (dx / EARTH_RADIUS)) / Math.cos(centerLat * TO_RAD);
            points.push([lon, lat]);
        }
        return points;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const map = mapContext.getMap();
            // Two layers, so the accuracy halo draws UNDER the marker: the SDK draws a layer at a
            // time, and one source cannot order two elements against each other.
            this.localBackVectorDataSource = map.source('source.userLocation.back', { type: 'local', projection: { type: 'EPSG:4326' } });
            this.localBackVectorLayer = map.buildLayer('layer.userLocation.back', { type: 'elements', source: this.localBackVectorDataSource.id, visibleZoomRange: [0, 24] });
            this.localVectorDataSource = map.source('source.userLocation', { type: 'local', projection: { type: 'EPSG:4326' } });
            this.localVectorLayer = map.buildLayer('layer.userLocation', { type: 'elements', source: this.localVectorDataSource.id, visibleZoomRange: [0, 24] });
            this.localVectorLayer.onElementClick((e) => {
                e.consumed = mapContext.vectorElementClicked(mapContext.elementClickData(e));
            });

            // always add it at 1 to respect local order
            mapContext.addLayer(this.localBackVectorLayer, 'userLocation');
            mapContext.addLayer(this.localVectorLayer, 'userLocation');
        }
    }
    override onMapInteraction(e: { data: MapInteraction }) {
        const interaction = e.data;
        if (!interaction.zoomAction && interaction.panAction && !interaction.animationStarted) {
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
            !this.map ||
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
            const poses = this.getCirclePoints(position);
            if (!this.accuracyMarker) {
                // a polygon style takes its border line inline
                this.accuracyMarker = mapContext.getMap().object('element', 'element.userLocation.accuracy', {
                    type: 'polygon',
                    poses,
                    style: {
                        type: 'polygon',
                        color: new Color(70, 14, 122, 254).argb,
                        lineStyle: { type: 'line', color: new Color(150, 14, 122, 254).argb, width: 1 }
                    }
                });
                this.localBackVectorDataSource.call('add', this.accuracyMarker.handle);
            } else {
                // the whole geometry: its poses are read-only (`Polygon::setPoses` is not in the SDK's property table)
                this.accuracyMarker.set('geometry', { type: 'polygon', poses });
            }
            // the halo belongs to the dot: around the arrow it just draws a circle that never goes away
            this.accuracyMarker.set('visible', !useArrow && accuracy > 20);
        }

        const { colorOnPrimary, colorPrimary } = get(colors);
        const kind: UserMarkerKind = useArrow ? 'arrow' : 'dot';
        const color = useArrow ? colorPrimary : accuracyColor;
        // with a halo to say how good the fix is, the dot itself can keep one size
        const size = useArrow ? ARROW_MARKER_SIZE : accuracyMarkerEnabled ? DOT_MARKER_SIZE : accuracySize;
        const styleKey = `${kind}|${color}|${size}`;
        if (!this.userMarker) {
            this.userMarker = mapContext.getMap().object('element', 'element.userLocation', {
                type: 'marker',
                position: toPosition(newPos),
                style: this.userMarkerStyle(kind, color, size, colorOnPrimary),
                metaData: { userMarker: 'true' }
            });
            this.localVectorDataSource.call('add', this.userMarker.handle);
        } else if (styleKey !== this.userMarkerStyleKey) {
            // rebuilding a style means rebuilding its bitmap, so only ever on a real change of look
            const style = mapContext.getMap().object('elementstyle', `elementstyle.userLocation.${styleKey}`, this.userMarkerStyle(kind, color, size, colorOnPrimary));
            this.userMarker.set('style', style.handle);
        }
        this.userMarkerStyleKey = styleKey;
        // as above: PointGeometry's `pos` is read-only, so the marker is moved by its geometry
        this.userMarker.set('geometry', { type: 'point', pos: toPosition(newPos) });
        // keep the last known heading: a chevron snapping back to north is worse than a stale one
        this.userMarker.set('rotation', useArrow ? -this.lastKnownBearing : 0);
        this.userMarker.set('visible', true);
    }

    private userMarkerStyle(kind: UserMarkerKind, color: string, size: number, outlineColor: string): api.SpecArg<'elementstyle', 'marker'> {
        return {
            type: 'marker',
            size,
            bitmap: { type: 'url', url: getUserBitmapUrl(kind, color, outlineColor) },
            // carto anchors at (0, -1), the pin tip; this marker *is* the place, so centre it
            anchorPointX: 0,
            anchorPointY: 0,
            // GROUND so the chevron turns with the map rather than staying upright on screen
            orientationMode: 'BILLBOARD_ORIENTATION_GROUND',
            scalingMode: 'BILLBOARD_SCALING_CONST_SCREEN_SIZE'
        };
    }
    /** set by NavigationService while navigating: the speed/maneuver derived zoom to hold */
    navigationZoom = 0;

    /** One camera move: separate position/zoom/rotation/tilt animations fight each other and stutter. */
    moveToUserLocation(duration = LOCATION_ANIMATION_DURATION) {
        if (!this.mLastUserLocation) {
            return;
        }
        const map = mapContext.getMap();
        const camera = map.camera();
        const zoom = this.navigationZoom > 0 ? this.navigationZoom : Math.max(camera.zoom(), 10);
        const target = toPosition(this.mLastUserLocation);
        if (!this.navigationMode) {
            camera.moveTo(target, { zoom, duration });
            return;
        }
        // the user sits low on the screen while navigating. A ScreenPos is `[x, y]`: an {x, y}
        // object decodes to nothing
        map.set('focusPointOffset', [
            mapContext.focusOffset.x,
            mapContext.focusOffset.y - Utils.layout.toDevicePixels(screenHeightDips) * ApplicationSettings.getNumber(SETTINGS_NAVIGATION_POSITION_OFFSET, DEFAULT_NAVIGATION_POSITION_OFFSET)
        ]);
        const tilt = ApplicationSettings.getNumber(SETTINGS_NAVIGATION_TILT, DEFAULT_NAVIGATION_TILT);
        camera.moveTo(target, {
            zoom,
            // same bearing as the arrow. A fix bearing can be missing: NaN is written as null and the
            // native decoder then rejects the whole flyTo
            rotation: -this.lastKnownBearing,
            tilt: tilt > 0 ? tilt : undefined,
            duration
        });
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

    /** @param force restart even when already watching, to apply changed watch options */
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
    /** Navigation drives the watch directly, so the stores must be resynced with the watch actually running. */
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
