import { MapPosVector } from 'nativescript-carto/core/core';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { VectorLayer } from 'nativescript-carto/layers/vector';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { LineStyleBuilder } from 'nativescript-carto/vectorelements/line';
import { Point, PointStyleBuilder } from 'nativescript-carto/vectorelements/point';
import { Polygon, PolygonStyleBuilder } from 'nativescript-carto/vectorelements/polygon';
import { GeoLocation } from 'nativescript-gps';
import { Color } from 'tns-core-modules/color/color';
import * as Animation from '~/animation';
import Map from '~/components/Map';
import { GeoHandler, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';
import MapModule from './MapModule';

const LOCATION_ANIMATION_DURATION = 300;

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
            console.log('set userFollow', value);
            this._userFollow = value;
            if (value) {
                // this.mapComp.askUserLocation();
            }
        }
    }

    onMapReady(mapComp: Map, mapView: CartoMap) {
        super.onMapReady(mapComp, mapView);
        this.log('onMapReady', this._userFollow);
    }
    onMapDestroyed() {
        super.onMapDestroyed();
        this.localVectorLayer = null;
        if (this.localVectorDataSource) {
            this.localVectorDataSource.clear();
            this.localVectorDataSource = null;
        }
    }

    getCirclePoints(loc: Partial<GeoLocation>) {
        const EARTH_RADIUS = 6378137;
        const centerLat = loc.latitude;
        const centerLon = loc.longitude;
        const radius = loc.horizontalAccuracy;
        const N = Math.min(radius * 8, 100);

        const points = new MapPosVector();

        for (let i = 0; i <= N; i++) {
            const angle = (Math.PI * 2 * (i % N)) / N;
            const dx = radius * Math.cos(angle);
            const dy = radius * Math.sin(angle);
            const latitude = centerLat + (180 / Math.PI) * (dy / EARTH_RADIUS);
            const longitude = centerLon + ((180 / Math.PI) * (dx / EARTH_RADIUS)) / Math.cos((centerLat * Math.PI) / 180);
            points.add({ lat: latitude, lon: longitude });
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
    lastUserLocation: GeoLocation;
    updateUserLocation(geoPos: GeoLocation) {
        if (!this.mapView || (this.lastUserLocation && this.lastUserLocation.latitude === geoPos.latitude && this.lastUserLocation.longitude === geoPos.longitude)) {
            this.lastUserLocation = geoPos;
            return;
        }

        const position = { lat: geoPos.latitude, lon: geoPos.longitude, horizontalAccuracy: geoPos.horizontalAccuracy };
        // if (!!this.userFollow) {
        //     this.mapView.focusPos = position;
        //     this.mapView.zoom = 16;
        // }
        if (!this.userMarker) {
            this.getOrCreateLocalVectorLayer();
            // const projection = this.mapView.projection;

            let styleBuilder = new PolygonStyleBuilder({
                size: 16,
                color: new Color(70, 14, 122, 254),
                lineStyleBuilder: new LineStyleBuilder({
                    color: new Color(150, 14, 122, 254),
                    width: 1
                })
            });
            this.accuracyMarker = new Polygon({ positions: this.getCirclePoints(geoPos), styleBuilder });
            this.localVectorDataSource.add(this.accuracyMarker);

            styleBuilder = new PointStyleBuilder({
                size: 17,
                color: '#ffffff'
            });
            this.userBackMarker = new Point({ position, styleBuilder });
            this.localVectorDataSource.add(this.userBackMarker);
            styleBuilder = new PointStyleBuilder({
                size: 14,
                color: '#0e7afe'
            });
            this.userMarker = new Point({ position, styleBuilder });
            this.localVectorDataSource.add(this.userMarker);
            this.userBackMarker.position = position;
            this.userMarker.position = position;
        } else {
            const currentLocation = { latitude: this.lastUserLocation.latitude, longitude: this.lastUserLocation.longitude, horizontalAccuracy: this.lastUserLocation.horizontalAccuracy };
            new Animation.Animation(currentLocation)
                .to({ latitude: position.lat, longitude: position.lon, horizontalAccuracy: position.horizontalAccuracy }, LOCATION_ANIMATION_DURATION)
                .easing(Animation.Easing.Quadratic.Out)
                .onUpdate(newPos => {
                    this.userBackMarker.position = newPos;
                    this.userMarker.position = newPos;
                    this.accuracyMarker.positions = this.getCirclePoints(newPos);
                })
                .start();
            if (this.userFollow) {
                this.mapView.setZoom(Math.max(this.mapView.zoom, 16), geoPos, LOCATION_ANIMATION_DURATION);
            }
            // this.userBackMarker.position = position;
            // this.userMarker.position = position;
            // this.accuracyMarker.positions = this.getCirclePoints(position);
        }
        this.lastUserLocation = geoPos;
    }
    onLocation(data: UserLocationdEventData) {
        if (data.error) {
            console.log(data.error);
            return;
        }
        const { android, ios, ...toPrint } = data.location;
        // console.log('onLocation', this._userFollow, toPrint, this.userFollow);
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
        console.log('startWatchLocation');
        if (this.watchingLocation) {
            return;
        }
        this.userFollow = true;
        return this.geoHandler
            .enableLocation()
            .then(r => this.geoHandler.startWatch())
            .then(() => {
                this.watchingLocation = true;
                console.log('started watching location');
            });
    }
    stopWatchLocation() {
        console.log('stopWatchLocation');
        this.geoHandler.stopWatch();
        this.watchingLocation = false;
    }
    askUserLocation() {
        this.userFollow = true;
        return this.geoHandler.enableLocation().then(() => this.geoHandler.getLocation());
    }
    watchingLocation = false;
    onWatchLocation() {
        if (!this.watchingLocation) {
            this.startWatchLocation();
        } else {
            this.stopWatchLocation();
        }
    }
}
