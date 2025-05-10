<script context="module" lang="ts">
    import { getAirportPressureAtLocation, getAltitude, isSensorAvailable, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import type { CanvasLabel } from '@nativescript-community/ui-canvaslabel';
    import type { VectorElementEventData } from '@nativescript-community/ui-carto/layers/vector';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import type { ApplicationEventData, GridLayout } from '@nativescript/core';
    import { Application } from '@nativescript/core';
    import { onDestroy, onMount } from 'svelte';
    import type { NativeViewElementNode } from 'svelte-native/dom';
    import IconButton from '~/components/common/IconButton.svelte';
    import type { GeoHandler, GeoLocation, UserLocationdEventData } from '~/handlers/GeoHandler';
    import { l, lc, lu } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { colors } from '~/variables';
</script>

<script lang="ts">
    $: ({ colorPrimary } = $colors);
    let geoHandler: GeoHandler;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let firstCanvas: NativeViewElementNode<CanvasLabel>;

    let showLocationInfo = false;
    const hasBarometer = isSensorAvailable('barometer');
    let listeningForBarometer = false;
    let referencePressure = null;
    let airportRefName: string = null;
    let currentAltitude: number = null;
    let shownAltitude: number | string = null;
    let currentLocation: GeoLocation = null;

    const mapContext = getMapContext();
    mapContext.onVectorElementClicked((data: VectorElementEventData<LatLonKeys>) => {
        const { clickType, element, elementPos, metaData, position } = data;
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
        Application.on(Application.backgroundEvent, onAppPause);
        Application.on(Application.foregroundEvent, onAppResume);
    });
    onDestroy(() => {
        Application.off(Application.backgroundEvent, onAppPause);
        Application.off(Application.foregroundEvent, onAppResume);
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
                .then((r) => getAirportPressureAtLocation(AVWX_API_KEY, r.lat, r.lon))
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
    const dontListenForBarometerWhilePaused = true;
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
    const loadedListeners = [];
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
    backgroundColor={ isEInk ? "#ffffff" : "#00000077" }
    borderRadius={40}
    columns="auto,*,auto"
    height={70}
    padding={6}
    visibility={showLocationInfo ? 'visible' : 'collapse'}
    width={hasBarometer ? 200 : 150}
    scaleX={0.9}
    scaleY={0.9}
    on:tap={moveToUserLocation}
    on:swipe={switchLocationInfo}>
    {#if loaded}
        <label backgroundColor={ isEInk ? "#ffffff" : "#000000aa" } borderColor={colorPrimary} borderRadius={30} borderWidth={4} height={60} width={60} maxFontSize={22} fontSize={22} color={ isEInk ? "black" : "white" } textAlignment="center" verticalAlignment="middle" autoFontSize={true} html={`<b>${currentLocation && currentLocation.speed !== undefined ? Math.floor(currentLocation.speed) : ''}</b><br/><small><small><small><small>km/h</small></small></small></small>`} />
        <canvaslabel col={1} color={ isEInk ? "#000" : "#fff" } marginLeft={5}>
            <cspan color={isEInk ? "#000" : colorPrimary} fontSize={11} text={lu('altitude') + (listeningForBarometer ? `(${l('barometer')})` : '') + '\n'} verticalAlignment="top" />
            <cgroup verticalAlignment="middle">
                <cspan fontSize={20} fontWeight="bold" text={shownAltitude} />
                <cspan fontSize={12} text=" m" />
            </cgroup>
        </canvaslabel>
    {#if hasBarometer}
        <canvaslabel col={1} visibility={listeningForBarometer && airportRefName ? 'visible' : 'collapse'} color={ isEInk ? "#000" : "#fff" }>
            <cspan fontSize={9} text={airportRefName} textAlignment="right" verticalAlignment="bottom" />
        </canvaslabel>
        <stacklayout col={2} verticalAlignment="middle" visibility={hasBarometer ? 'visible' : 'collapse'}>
            <IconButton small={true} text="mdi-gauge" white={!isEInk} on:tap={switchBarometer} />
            <IconButton isVisible={listeningForBarometer} small={true} text="mdi-reflect-vertical" white={!isEInk} on:tap={getNearestAirportPressure} />
        </stacklayout>
    {/if}
    {/if}
</gridlayout>
