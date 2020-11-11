import { MapPos } from '@nativescript-community/ui-carto/core';

import { CartoMap } from '@nativescript-community/ui-carto/ui';
import { Component } from 'vue-property-decorator';
// import { layout } from '@nativescript/core/utils/utils';
import { IMapModule } from '~/mapModules/MapModule';
import BgServiceComponent from './BgServiceComponent';
import Map from './Map';
import {
    ApplicationEventData,
    off as applicationOff,
    on as applicationOn,
    resumeEvent,
    suspendEvent,
} from '@nativescript/core/application';
import * as sensors from '@nativescript-community/sensors';
import { GeoHandler } from '~/handlers/GeoHandler';
import { Accuracy } from '@nativescript/core/ui/enums';
import { getNumber, getString, setNumber, setString } from '@nativescript/core/application-settings';

// const OPEN_DURATION = 200;
// const CLOSE_DURATION = 200;
@Component({})
export default class LocationInfoPanel extends BgServiceComponent {
    mShowLocationInfo = false;

    hasBarometer = sensors.isSensorAvailable('barometer');
    listeningForBarometer = false;
    airportPressure = getNumber('airport_pressure', null);
    airportRefName: string = getString('airport_ref', null);
    mCurrentAltitude: number = null;
    currentLocation: MapPos<LatLonKeys> = null;

    get showLocationInfo() {
        return this.mShowLocationInfo;
    }
    set showLocationInfo(value) {
        this.mShowLocationInfo = value;
        if (value) {
            const module = this.$getMapComponent().mapModules.userLocation;
            module.on('location', this.onNewLocation, this);
            this.onNewLocation({ data: module.lastUserLocation });
        } else {
            this.$getMapComponent().mapModules.userLocation.off('location', this.onNewLocation, this);
            if (this.listeningForBarometer) {
                this.stopBarometerAltitudeUpdate();
            }
        }
    }
    get currentAltitude() {
        if (this.listeningForBarometer) {
            if (!this.airportPressure) {
                return this.$t('no_ref');
            }
            return this.mCurrentAltitude !== null ? this.mCurrentAltitude : '-';
        }
        if (this.mCurrentAltitude !== null) {
            return this.mCurrentAltitude;
        }
        return this.currentLocation && this.currentLocation.altitude !== undefined ? this.currentLocation.altitude : '-';
    }

    mounted() {
        super.mounted();

        applicationOn(suspendEvent, this.onAppPause, this);
        applicationOn(resumeEvent, this.onAppResume, this);
    }
    destroyed() {
        super.destroyed();

        applicationOff(suspendEvent, this.onAppPause, this);
        applicationOff(resumeEvent, this.onAppResume, this);
    }

    onServiceLoaded(geoHandler: GeoHandler) {}
    onServiceUnloaded(geoHandler: GeoHandler) {}

    async onNewLocation(e: any) {
        this.currentLocation = e.data;
        const altitude = await this.$packageService.getElevation(this.currentLocation);
        console.log('onNewLocation', this.currentLocation, altitude, typeof altitude);
        if (altitude !== null) {
            this.mCurrentAltitude = altitude;
        }
        // this.log('onNewLocation', this.currentLocation);
    }
    startBarometer() {
        if (this.listeningForBarometer) {
            sensors.startListeningForSensor('barometer', this.onSensor, 1000);
        }
    }
    stopBarometer() {
        if (this.listeningForBarometer) {
            sensors.stopListeningForSensor('barometer', this.onSensor);
        }
    }
    startBarometerAltitudeUpdate() {
        this.log('startBarometerAltitudeUpdate');
        if (!this.listeningForBarometer) {
            this.listeningForBarometer = true;
            this.startBarometer();
        }
    }
    stopBarometerAltitudeUpdate() {
        if (this.listeningForBarometer) {
            this.stopBarometer();
            this.listeningForBarometer = false;
        }
    }
    switchBarometer() {
        if (this.listeningForBarometer) {
            this.stopBarometerAltitudeUpdate();
        } else {
            this.startBarometerAltitudeUpdate();
        }
    }
    getNearestAirportPressure() {
        return this.geoHandler.enableLocation().then(() => {
            this.geoHandler
                .getLocation({ desiredAccuracy: Accuracy.high, maximumAge: 120000 })
                .then((r) => sensors.getAirportPressureAtLocation(gVars.AVWX_API_KEY, r.lat, r.lon))
                .then((r) => {
                    this.airportPressure = r.pressure;
                    this.airportRefName = r.name;
                    setNumber('airport_pressure', this.airportPressure);
                    setString('airport_ref', this.airportRefName);
                    alert(`found nearest airport pressure ${r.name} with pressure:${r.pressure} hPa`);
                })
                .catch((err) => {
                    alert(`could not find nearest airport pressure: ${err}`);
                });
        });
    }
    onSensor(data, sensor: string) {
        if (sensor === 'barometer' && this.airportPressure != null) {
            // we can compute altitude
            if (this.airportPressure) {
                // this.log('barometer', data.timestamp, data.pressure, this.airportPressure);
                this.mCurrentAltitude = Math.round(sensors.getAltitude(data.pressure, this.airportPressure));
                this.stopBarometer();
                if (this.listeningForBarometer) {
                    setTimeout(() => {
                        this.startBarometer();
                    }, 5000);
                }
            }
        }
    }
    wasListeningForBarometerBeforePause = false;
    dontListenForBarometerWhilePaused = true;
    onAppResume(args: ApplicationEventData) {
        if (this.wasListeningForBarometerBeforePause) {
            this.startBarometerAltitudeUpdate();
            this.wasListeningForBarometerBeforePause = false;
        }
    }
    onAppPause(args: ApplicationEventData) {
        if (this.listeningForBarometer) {
            if (this.dontListenForBarometerWhilePaused) {
                this.wasListeningForBarometerBeforePause = true;
                this.stopBarometerAltitudeUpdate();
            }
        }
    }
}
