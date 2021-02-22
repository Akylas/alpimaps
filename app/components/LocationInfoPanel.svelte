<script lang="ts" context="module">
    import { l, lu } from '@nativescript-community/l';
    import {
        getAirportPressureAtLocation,
        isSensorAvailable,
        startListeningForSensor,
        stopListeningForSensor
    } from '@nativescript-community/sensors';
    import { getAltitude } from '@nativescript-community/sensors/sensors.common';
    import { CanvasLabel } from '@nativescript-community/ui-canvaslabel';
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { GridLayout } from '@nativescript/core';
    import type { ApplicationEventData } from '@nativescript/core/application';
    import { off as applicationOff, on as applicationOn, resumeEvent, suspendEvent } from '@nativescript/core/application';
    import { getNumber, getString, setNumber, setString } from '@nativescript/core/application-settings';
    import { Accuracy } from '@nativescript/core/ui/enums';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { packageService } from '~/services/PackageService';
    import { accentColor } from '~/variables';
</script>

<script lang="ts">
    let geoHandler: GeoHandler;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let firstCanvas: NativeViewElementNode<CanvasLabel>;

    let showLocationInfo = false;
    const mapContext = getMapContext();

    export function switchLocationInfo() {
        showLocationInfo = !showLocationInfo;
        if (showLocationInfo) {
            loadView();
        }
    }

    let hasBarometer = isSensorAvailable('barometer');
    let listeningForBarometer = false;
    let airportPressure = getNumber('airport_pressure', null);
    let airportRefName: string = getString('airport_ref', null);
    let currentAltitude: number = null;
    let shownAltitude: number | string = null;
    let currentLocation: MapPos<LatLonKeys> = null;

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }

    $: {
        const module = mapContext.mapModule('userLocation');
        if (module) {
            if (showLocationInfo) {
                module.on('location', onNewLocation, this);
                onNewLocation({ data: module.lastUserLocation });
            } else {
                module.off('location', onNewLocation, this);
                if (listeningForBarometer) {
                    stopBarometerAltitudeUpdate();
                }
            }
        }
    }
    $: {
        if (listeningForBarometer) {
            if (!airportPressure) {
                shownAltitude = l('no_ref');
            }
            shownAltitude = currentAltitude !== null ? currentAltitude : '-  ';
        } else if (currentAltitude !== null) {
            shownAltitude = currentAltitude;
        } else {
            shownAltitude = currentLocation && currentLocation.altitude !== undefined ? currentLocation.altitude : '-  ';
        }
    }

    onMount(() => {
        applicationOn(suspendEvent, onAppPause, this);
        applicationOn(resumeEvent, onAppResume, this);
    });
    onDestroy(() => {
        applicationOff(suspendEvent, onAppPause, this);
        applicationOff(resumeEvent, onAppResume, this);
    });

    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
    });

    async function onNewLocation(e: any) {
        currentLocation = e.data;
        if (currentLocation) {
            const altitude = await packageService.getElevation(currentLocation);
            if (altitude !== null) {
                currentAltitude = Math.round(altitude);
            }
        } else {
            currentAltitude = null;
        }
    }
    function startBarometer() {
        if (listeningForBarometer) {
            startListeningForSensor('barometer', onSensor, 1000);
        }
    }
    function stopBarometer() {
        if (listeningForBarometer) {
            stopListeningForSensor('barometer', onSensor);
        }
    }
    function startBarometerAltitudeUpdate() {
        console.log('startBarometerAltitudeUpdate');
        if (!listeningForBarometer) {
            listeningForBarometer = true;
            startBarometer();
        }
    }
    function stopBarometerAltitudeUpdate() {
        if (listeningForBarometer) {
            stopBarometer();
            listeningForBarometer = false;
        }
    }
    function switchBarometer() {
        if (listeningForBarometer) {
            stopBarometerAltitudeUpdate();
        } else {
            startBarometerAltitudeUpdate();
        }
    }
    function getNearestAirportPressure() {
        return geoHandler.enableLocation().then(() => {
            geoHandler
                .getLocation({ maximumAge: 120000 })
                .then((r) => getAirportPressureAtLocation(gVars.AVWX_API_KEY, r.lat, r.lon))
                .then((r) => {
                    airportPressure = r.pressure;
                    airportRefName = r.name;
                    setNumber('airport_pressure', airportPressure);
                    setString('airport_ref', airportRefName);
                    alert(`found nearest airport pressure ${r.name} with pressure:${r.pressure} hPa`);
                })
                .catch((err) => {
                    alert(`could not find nearest airport pressure: ${err}`);
                });
        });
    }
    function onSensor(data, sensor: string) {
        if (sensor === 'barometer' && airportPressure != null) {
            // we can compute altitude
            if (airportPressure) {
                // console.log('barometer', data.timestamp, data.pressure, airportPressure);
                currentAltitude = Math.round(getAltitude(data.pressure, airportPressure));
                stopBarometer();
                if (listeningForBarometer) {
                    setTimeout(() => {
                        startBarometer();
                    }, 5000);
                }
            }
        }
    }
    let wasListeningForBarometerBeforePause = false;
    let dontListenForBarometerWhilePaused = true;
    function onAppResume(args: ApplicationEventData) {
        if (wasListeningForBarometerBeforePause) {
            startBarometerAltitudeUpdate();
            wasListeningForBarometerBeforePause = false;
        }
    }
    function onAppPause(args: ApplicationEventData) {
        if (listeningForBarometer) {
            if (dontListenForBarometerWhilePaused) {
                wasListeningForBarometerBeforePause = true;
                stopBarometerAltitudeUpdate();
            }
        }
    }
    let loaded = false;
    let loadedListeners = [];
    async function loadView() {
        if (!loaded) {
            await new Promise((resolve) => {
                loadedListeners.push(resolve);
                loaded = true;
            });
        }
    }
    $: {
        if (firstCanvas) {
            loadedListeners.forEach((l) => l());
        }
    }
</script>

<gridlayout
    {...$$restProps}
    bind:this={gridLayout}
    id="locationInfo"
    width="200"
    visibility={showLocationInfo ? 'visible' : 'collapsed'}
    height="70"
    borderRadius="40"
    backgroundColor="#77000000"
    padding="6"
    columns="auto,*,auto"
    on:swipe={() => (showLocationInfo = false)}>
    {#if loaded}
        <canvaslabel
            bind:this={firstCanvas}
            width="60"
            height="60"
            borderRadius="30"
            borderWidth="4"
            borderColor={accentColor}
            backgroundColor="#aaffffff">
            <!-- <cgroup verticalAlignment="center" textAlignment="center"> -->
            <cspan
                text={currentLocation && currentLocation.speed !== undefined ? currentLocation.speed.toFixed() : '10'}
                fontSize="26"
                textAlignment="center"
                verticalAlignment="center"
                fontWeight="bold"
            />
            <cspan text="km/h" fontSize="10" textAlignment="center" verticalAlignment="bottom" paddingBottom="3" />
            <!-- </cgroup> -->
        </canvaslabel>
        <canvaslabel col="1" marginLeft="5" color="#fff">
            <cspan
                text={lu('altitude') + (listeningForBarometer ? `(${l('barometer')})` : '') + '\n'}
                fontSize="11"
                color={accentColor}
                verticalAlignment="top"
            />
            <cgroup verticalAlignment="middle">
                <cspan text={shownAltitude} fontSize="20" fontWeight="bold" />
                <cspan text=" m" fontSize="12" />
            </cgroup>
        </canvaslabel>
        <canvaslabel col="1" visibility={listeningForBarometer && airportRefName ? 'visible' : 'collapsed'}>
            <cspan text={airportRefName} verticalTextAlignment="bottom" textAlignment="right" color="#fff" fontSize="9" />
        </canvaslabel>
        <stacklayout visibility={hasBarometer ? 'visible' : 'collapsed'} col="2" verticalAlignment="center">
            <button variant="text" class="small-icon-btn" text="mdi-gauge" on:tap={switchBarometer} color="white" />
            <button
                variant="text"
                class="small-icon-btn"
                visibility={listeningForBarometer ? 'visible' : 'collapsed'}
                text="mdi-reflect-vertical"
                on:tap={getNearestAirportPressure}
                color="white"
            />
        </stacklayout>
    {/if}
</gridlayout>
