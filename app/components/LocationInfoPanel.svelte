<script lang="ts" context="module">
    import { getAirportPressureAtLocation, isSensorAvailable, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { getAltitude } from '@nativescript-community/sensors/sensors';
    import { CanvasLabel } from '@nativescript-community/ui-canvaslabel';
    import { VectorElementEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { GridLayout } from '@nativescript/core';
    import type { ApplicationEventData } from '@nativescript/core/application';
    import { off as applicationOff, on as applicationOn } from '@nativescript/core/application';
    import { backgroundEvent, foregroundEvent } from '@akylas/nativescript/application';
    import { onDestroy, onMount } from 'svelte';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler, GeoLocation, UserLocationdEventData } from '~/handlers/GeoHandler';
    import { l, lc, lu } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { accentColor } from '~/variables';
</script>

<script lang="ts">
    let geoHandler: GeoHandler;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let firstCanvas: NativeViewElementNode<CanvasLabel>;

    let showLocationInfo = false;
    let hasBarometer = isSensorAvailable('barometer');
    let listeningForBarometer = false;
    let referencePressure = null;
    let airportRefName: string = null;
    let currentAltitude: number = null;
    let shownAltitude: number | string = null;
    let currentLocation: GeoLocation = null;

    const mapContext = getMapContext();
    mapContext.onVectorElementClicked((data: VectorElementEventData<LatLonKeys>) => {
        const { clickType, position, elementPos, metaData, element } = data;
        // console.log('LocationInfoPanel onVectorElementClicked', clickType, position, metaData);
        if ((metaData['userMarker'] as any) === true) {
            switchLocationInfo();
            return true;
        }
    });
    export function switchLocationInfo() {
        showLocationInfo = !showLocationInfo;
        if (showLocationInfo) {
            loadView();
        }
    }

    function moveToUserLocation() {
        mapContext.mapModule('userLocation')?.moveToUserLocation();
    }

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }

    $: {
        const module = mapContext.mapModule('userLocation');
        if (module) {
            if (showLocationInfo) {
                module.on('location', onNewLocation);
                onNewLocation({ data: module.lastUserLocation } as any);
            } else {
                module.off('location', onNewLocation);
                if (listeningForBarometer) {
                    stopBarometerAltitudeUpdate();
                }
            }
        }
    }
    $: {
        if (listeningForBarometer) {
            if (!referencePressure) {
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
        applicationOn(backgroundEvent, onAppPause);
        applicationOn(foregroundEvent, onAppResume);
    });
    onDestroy(() => {
        applicationOff(backgroundEvent, onAppPause);
        applicationOff(foregroundEvent, onAppResume);
    });

    onServiceLoaded((handler: GeoHandler) => {
        geoHandler = handler;
    });

    async function onNewLocation(e: UserLocationdEventData) {
        currentLocation = e.data;
        if (currentLocation) {
            currentAltitude = currentLocation.altitude;
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
    function resetReference() {
        referencePressure = null;
        airportRefName = null;
    }
    async function getNearestAirportPressure() {
        referencePressure = null;
        airportRefName = null;
        if (!networkService.connected || packageService.hasElevation()) {
            return;
        }
        return geoHandler.enableLocation().then(() => {
            geoHandler
                .getLocation({ maximumAge: 120000 })
                .then((r) => getAirportPressureAtLocation(gVars.AVWX_API_KEY, r.lat, r.lon))
                .then((r) => {
                    referencePressure = r.pressure;
                    airportRefName = r.name;
                    alert(`found nearest airport pressure ${r.name} with pressure:${r.pressure} hPa`);
                })
                .catch((err) => {
                    alert(`could not find nearest airport pressure: ${err}`);
                });
        });
    }
    async function onSensor(data, sensor: string) {
        switch (sensor) {
            case 'barometer':
                if (referencePressure != null) {
                    currentAltitude = Math.round(getAltitude(data.pressure, referencePressure));
                    stopBarometer();
                    if (listeningForBarometer) {
                        setTimeout(() => {
                            startBarometer();
                        }, 5000);
                    }
                } else if (currentLocation && Date.now() - currentLocation.timestamp < 60 * 1000 * 10 && currentAltitude) {
                    stopBarometer();
                    let assumedTemp = 15;
                    const result = await prompt({
                        title: lc('current_temperature'),
                        // message: this.$tc('change_glasses_name'),
                        okButtonText: l('set'),
                        cancelButtonText: l('cancel'),
                        autoFocus: true,
                        defaultText: assumedTemp + ''
                    });
                    if (result && !!result.result && result.text.length > 0) {
                        assumedTemp = parseFloat(result.text);
                    }
                    referencePressure = data.pressure * Math.pow(1 - (0.0065 * currentLocation.altitude) / (assumedTemp + 0.0065 * currentLocation.altitude + 273.15), -5.257);

                    if (listeningForBarometer) {
                        setTimeout(() => {
                            startBarometer();
                        }, 5000);
                    }
                }
                break;
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
            loadedListeners.forEach((listener) => listener());
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
    backgroundColor="#00000077"
    padding="6"
    columns="auto,*,auto"
    on:tap={moveToUserLocation}
    on:swipe={switchLocationInfo}
>
    {#if loaded}
        <canvaslabel bind:this={firstCanvas} width="60" height="60" borderRadius="30" borderWidth="4" borderColor={accentColor} backgroundColor="#000000aa"  color="#fff">
            <cspan text={currentLocation && currentLocation.speed !== undefined ? currentLocation.speed.toFixed() : ''} fontSize="26" fontWeight="bold" textAlignment="center" verticalAlignment="center" paddingBottom="3"/>
            <cspan text={'km/h'} fontSize="10" textAlignment="center" verticalAlignment="center" paddingTop="12"/>
        </canvaslabel>
        <canvaslabel col={1} marginLeft="5" color="#fff">
            <cspan text={lu('altitude') + (listeningForBarometer ? `(${l('barometer')})` : '') + '\n'} fontSize="11" color={accentColor} verticalAlignment="top" />
            <cgroup verticalAlignment="middle">
                <cspan text={shownAltitude} fontSize="20" fontWeight="bold" />
                <cspan text=" m" fontSize="12" />
            </cgroup>
        </canvaslabel>
        <canvaslabel col={1} visibility={listeningForBarometer && airportRefName ? 'visible' : 'collapsed'}>
            <cspan text={airportRefName} verticalAlignment="bottom" textAlignment="right" color="#fff" fontSize="9" />
        </canvaslabel>
        <stacklayout visibility={hasBarometer ? 'visible' : 'collapsed'} col={2} verticalAlignment="center">
            <button variant="text" class="small-icon-btn" text="mdi-gauge" on:tap={switchBarometer} color="white" />
            <button variant="text" class="small-icon-btn" visibility={listeningForBarometer ? 'visible' : 'collapsed'} text="mdi-reflect-vertical" on:tap={getNearestAirportPressure} color="white" />
        </stacklayout>
    {/if}
</gridlayout>
