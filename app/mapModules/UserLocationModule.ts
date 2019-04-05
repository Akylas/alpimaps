import { GeoLocation } from 'nativescript-gps';
import { Color } from 'tns-core-modules/color/color';
import { MapPosVector } from 'nativescript-carto/core/core';
import { LocalVectorDataSource } from 'nativescript-carto/datasources/vector';
import { VectorLayer } from 'nativescript-carto/layers/vector';
import { Projection } from 'nativescript-carto/projections/projection';
import { CartoMap } from 'nativescript-carto/ui/ui';
import { LineStyleBuilder } from 'nativescript-carto/vectorelements/line';
import { Point, PointStyleBuilder } from 'nativescript-carto/vectorelements/point';
import { Polygon, PolygonStyleBuilder } from 'nativescript-carto/vectorelements/polygon';
import Map from '~/components/Map';
import MapModule from './MapModule';
import { GeoHandler, UserLocationdEvent, UserLocationdEventData } from '~/handlers/GeoHandler';

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
        this._userFollow = value;
        if (value) {
            this.mapComp.askUserLocation();
        }
    }

    onMapReady(mapComp: Map, mapView: CartoMap) {
        this.mapView = mapView;
        this.mapComp = mapComp;
    }

    getCirclePoints(loc: GeoLocation, projection: Projection) {
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
            points.add(projection.fromWgs84({ latitude, longitude }));
        }

        return points;
    }
    getOrCreateLocalVectorLayer() {
        if (!this.localVectorLayer) {
            const projection = this.mapView.projection;
            this.localVectorDataSource = new LocalVectorDataSource({ projection });

            const layer = new VectorLayer({ dataSource: this.localVectorDataSource });

            // always add it at 1 to respect local order
            this.mapView.addLayer(layer);
        }
    }
    updateUserLocation(position: GeoLocation) {
        if (!this.mapView) {
            return;
        }
        // if (!!this.userFollow) {
        //     this.mapView.focusPos = position;
        //     this.mapView.zoom = 16;
        // }
        if (!this.userMarker) {
            this.getOrCreateLocalVectorLayer();
            const projection = this.mapView.projection;

            let styleBuilder = new PolygonStyleBuilder({
                size: 16,
                color: new Color(70, 14, 122, 254),
                lineStyleBuilder: new LineStyleBuilder({
                    color: new Color(150, 14, 122, 254),
                    width: 1
                })
            });
            this.accuracyMarker = new Polygon({ positions: this.getCirclePoints(position, projection), projection, styleBuilder });
            this.localVectorDataSource.add(this.accuracyMarker);

            styleBuilder = new PointStyleBuilder({
                size: 17,
                color: '#ffffff'
            });
            this.userBackMarker = new Point({ position, projection, styleBuilder });
            this.localVectorDataSource.add(this.userBackMarker);
            styleBuilder = new PointStyleBuilder({
                size: 16,
                color: '#0e7afe'
            });
            this.userMarker = new Point({ position, projection, styleBuilder });
            this.localVectorDataSource.add(this.userMarker);
        } else {
            const projection = this.mapView.projection;
            this.userBackMarker.position = position;
            this.userMarker.position = position;
            this.accuracyMarker.positions = this.getCirclePoints(position, projection);
        }
    }
    onLocation(data: UserLocationdEventData) {
        if (data.error) {
            console.log(data.error);
            return;
        }
        const { android, ios, ...toPrint } = data.location;
        console.log('onLocation', toPrint, this.userFollow);
        this.updateUserLocation(data.location);
        if (!!this.userFollow) {
            this.mapView.setFocusPos(data.location, 200);
            this.mapView.setZoom(Math.max(this.mapView.zoom, 14), 200);
        }
    }
    onServiceLoaded(geoHandler: GeoHandler) {
        geoHandler.on(UserLocationdEvent, this.onLocation, this);
    }
    onServiceUnloaded(geoHandler: GeoHandler) {
        geoHandler.off(UserLocationdEvent, this.onLocation, this);
    }
}
