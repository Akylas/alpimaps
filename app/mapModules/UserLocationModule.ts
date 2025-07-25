import { lc } from '@nativescript-community/l';
import { MapPos, MapPosVector, fromNativeMapPos, fromNativeScreenPos, toNativeScreenPos } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
import { Tween } from '@nativescript-community/ui-chart/animation/Tween';
import { showSnack } from '~/utils/ui';
import { ApplicationSettings, Color, Utils } from '@nativescript/core';
import dayjs from 'dayjs';
import { get, writable } from 'svelte/store';
import { GeoHandler, GeoLocation, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import { getBGServiceInstance } from '~/services/BgService';
import { packageService } from '~/services/PackageService';
import { queryingLocation, watchingLocation } from '~/stores/mapStore';
import { EARTH_RADIUS, PI_X2, TO_DEG, TO_RAD } from '~/utils/geo';
import MapModule, { getMapContext } from './MapModule';
import { MapInteractionInfo } from '@nativescript-community/ui-carto/ui';
import { DEFAULT_NAVIGATION_POSITION_OFFSET, DEFAULT_NAVIGATION_TILT, SETTINGS_NAVIGATION_POSITION_OFFSET, SETTINGS_NAVIGATION_TILT } from '~/utils/constants';
import { screenHeightDips } from '~/variables';

const LOCATION_ANIMATION_DURATION = 300;

export const navigationModeStore = writable(false);

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
            if (!value) {
                this.navigationMode = false;
            }
        }
    }
    get navigationMode() {
        return get(navigationModeStore);
    }
    set navigationMode(value: boolean) {
        navigationModeStore.set(value);
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
        let accuracyColor = '#0e7afe';
        let accuracySize = 14;
        const accuracy = geoPos.horizontalAccuracy || 0;
        if (geoPos.age > 120000) {
            accuracyColor = 'gray';
        } else if (accuracy > 1000) {
            accuracySize = 8;
            accuracyColor = 'red';
        } else if (accuracy > 20) {
            accuracySize = 11;
            accuracyColor = 'orange';
        }
        if (!this.userMarker) {
            const posWithoutAltitude = { lat: position.lat, lon: position.lon };
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
                    size: accuracyMarkerEnabled ? 14 : accuracySize,
                    color: accuracyColor
                }
            });
            this.localVectorDataSource.add(this.userBackMarker);
            this.localVectorDataSource.add(this.userMarker);
        } else {
            this.userMarker.color = accuracyColor;
            const newPos = { lat: position.lat, lon: position.lon };
            // TODO: fix tween animation which is only working once
            // console.log('animating position', { lat: this.lastUserLocation.lat, lon: this.lastUserLocation.lon }, { lat: position.lat, lon: position.lon });
            // try {
            //     new Tween({
            //         onRender: (newPos: any) => {
            //             try {
            //                 console.log('onRender', newPos);
            //                 if (this.userMarker) {
            //                     this.accuracyMarker.positions = this.getCirclePoints(newPos);
            //                     this.userBackMarker.position = newPos;
            //                     this.userMarker.position = newPos;
            //                 }
            //             } catch (error) {
            //                 console.error(error);
            //             }
            //         }
            //     }).tween({ lat: this.lastUserLocation.lat, lon: this.lastUserLocation.lon, time: 0 }, { lat: position.lat, lon: position.lon, time: 1 }, LOCATION_ANIMATION_DURATION);
            // } catch (err) {
            //     console.error(err);
            // }
            this.userBackMarker.position = newPos;
            this.userMarker.position = newPos;
            if (this.accuracyMarker){
                this.accuracyMarker.positions = this.getCirclePoints(newPos);
                this.accuracyMarker.visible = accuracy > 20;
            } else {
                this.userMarker.size = accuracySize;
            }
            
        }
        this.lastUserLocation = position;
        const inBackground = getBGServiceInstance().appInBackground;
        if (this.userFollow) {
            this.moveToUserLocation(inBackground ? 0 : undefined);
        }
        if (__ANDROID__ && inBackground) {
            const a9ScreenRefresh = ApplicationSettings.getBoolean('a9_background_location_screenrefresh', false);
            if (a9ScreenRefresh) {
                const broadcastIntent = new android.content.Intent(ApplicationSettings.getString('refreshAlarmBroadcast', "com.akylas.A9_REFRESH_SCREEN"));       
                broadcastIntent.putExtra('sleep_delay', ApplicationSettings.getNumber('a9_background_location_screenrefresh_delay',100));   
                const context = Utils.android.getApplicationContext();            
                context.sendBroadcast(broadcastIntent);
            }
        }
    }
    moveToUserLocation(duration = LOCATION_ANIMATION_DURATION) {
        if (!this.mLastUserLocation) {
            return;
        }
        this.mapView.setZoom(Math.max(this.mapView.zoom, 10), duration);
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

    async startWatchLocation() {
        if (get(watchingLocation) || !this.geoHandler) {
            return;
        }
        await this.geoHandler.enableLocation();
        await this.geoHandler.startWatch();
        this.userFollow = true;
        watchingLocation.set(true);
        if (!get(queryingLocation)) {
            showSnack({
                message: lc('watching_location')
            });
        }
    }
    stopWatchLocation() {
        // console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        watchingLocation.set(false);
        queryingLocation.set(false);
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
