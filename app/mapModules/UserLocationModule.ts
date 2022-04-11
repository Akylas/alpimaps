import { lc } from '@nativescript-community/l';
import { MapPos, MapPosVector } from '@nativescript-community/ui-carto/core';
import { LocalVectorDataSource } from '@nativescript-community/ui-carto/datasources/vector';
import { VectorLayer } from '@nativescript-community/ui-carto/layers/vector';
import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Point } from '@nativescript-community/ui-carto/vectorelements/point';
import { Polygon } from '@nativescript-community/ui-carto/vectorelements/polygon';
import { Tween } from '@nativescript-community/ui-chart/animation/Tween';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { Color } from '@nativescript/core';
import dayjs from 'dayjs';
import { GeoHandler, GeoLocation, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import { packageService } from '~/services/PackageService';
import mapStore from '~/stores/mapStore';
import { EARTH_RADIUS, PI_X2, TO_DEG, TO_RAD } from '~/utils/geo';
import MapModule, { getMapContext } from './MapModule';

const LOCATION_ANIMATION_DURATION = 300;

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
    onMapMove(e) {
        if (e.data.userAction) {
            this.userFollow = false;
        }
    }
    public mLastUserLocation: MapPos<LatLonKeys> & { horizontalAccuracy: number; verticalAccuracy: number; speed: number } = null;
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
        if (!this.userMarker) {
            const posWithoutAltitude = { lat: position.lat, lon: position.lon };
            this.getOrCreateLocalVectorLayer();

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

            const currentPosition = { ...this.lastUserLocation };
            try {
                new Tween({
                    onRender: (newPos: any) => {
                        if (this.userMarker) {
                            this.accuracyMarker.positions = this.getCirclePoints(newPos);
                            this.userBackMarker.position = newPos;
                            this.userMarker.position = newPos;
                        }
                    }
                }).tween({ lat: currentPosition.lat, lon: currentPosition.lon }, { lat: position.lat, lon: position.lon }, LOCATION_ANIMATION_DURATION);
            } catch (err) {
                console.error(err);
            }

            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
            // this.accuracyMarker.positions = this.getCirclePoints(position);
        }
        if (this.userFollow) {
            this.moveToUserLocation();
        }
        this.lastUserLocation = position;
    }
    moveToUserLocation() {
        if (!this.mLastUserLocation) {
            return;
        }
        this.mapView.setZoom(Math.max(this.mapView.zoom, 16), LOCATION_ANIMATION_DURATION);
        this.mapView.setFocusPos(this.mLastUserLocation, LOCATION_ANIMATION_DURATION);
    }
    onLocation(event: UserLocationdEventData) {
        if (mapStore.queryingLocation) {
            this.stopWatchLocation();
            mapStore.queryingLocation = false;
        }
        // const { android, ios, ...toPrint } = data.location;
        // if (DEV_LOG) {
        //     console.log('onLocation', this._userFollow, event.location, this.userFollow);
        // }
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
        this.updateUserLocation(geoHandler.getLastKnownLocation());
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler && geoHandler.off(UserLocationdEvent, this.onLocation, this);
        this.geoHandler = null;
    }

    async startWatchLocation() {
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
        await this.geoHandler.enableLocation();
        mapStore.queryingLocation = true;
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
}
