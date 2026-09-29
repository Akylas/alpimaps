<script context="module" lang="ts">
    import { getAirportPressureAtLocation, getAltitude, isSensorAvailable, startListeningForSensor, stopListeningForSensor } from '@nativescript-community/sensors';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import type { ApplicationEventData, GridLayout } from '@nativescript/core';
    import { Application } from '@nativescript/core';
    import { onDestroy, onMount } from 'svelte';
    import type { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import IconButton from '~/components/common/IconButton.svelte';
    import type { GeoHandler, GeoLocation, UserLocationdEventData } from '~/handlers/GeoHandler';
    import { UNITS, convertValueToUnit } from '~/helpers/formatter';
    import { l, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { networkService } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import { colors, fonts } from '~/variables';
</script>

<script lang="ts">
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);
    let geoHandler: GeoHandler;
    let gridLayout: NativeViewElementNode<GridLayout>;
    let firstCanvas: NativeViewElementNode<GridLayout>;

    let showLocationInfo = false;
    const hasBarometer = isSensorAvailable('barometer');
    let listeningForBarometer = false;
    let referencePressure = null;
    let airportRefName: string = null;
    let currentAltitude: number = null;
    let shownAltitude: number | string = null;
    let currentLocation: GeoLocation = null;

    const mapContext = getMapContext();
    mapContext.onVectorElementClicked((data) => {
        const { metaData } = data;
        // the user marker is the app's own: `metaData` is what it was registered with
        if (metaData['userMarker'] === true || metaData['userMarker'] === 'true') {
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
    $: speedFormatted = convertValueToUnit(currentLocation?.speed * 3.6, UNITS.SpeedKm);
    $: altitudeFormatted = convertValueToUnit(shownAltitude, UNITS.Meters);
</script>

<!-- speed and altitude as the route sheet's stat tiles: an icon and caption over the value -->
<gridlayout
    {...$$restProps}
    bind:this={gridLayout}
    id="locationInfo"
    class="panel mapControl"
    borderRadius={20}
    columns="104,104,auto"
    height={64}
    padding="6 3"
    visibility={showLocationInfo ? 'visible' : 'collapse'}
    on:tap={moveToUserLocation}
    on:swipe={switchLocationInfo}>
    {#if loaded}
        <gridlayout bind:this={firstCanvas} backgroundColor={colorSurfaceFill} borderColor={colorHairline} borderRadius={14} borderWidth={isEInk ? 1 : 0} margin="0 3" padding="4 12" rows="auto,*">
            <canvaslabel color={colorOnSurfaceVariant} fontSize={11} height={16}>
                <cspan color={isEInk ? colorOnSurface : colorPrimary} fontFamily={$fonts.mdi} fontSize={13} text="mdi-speedometer" verticalAlignment="middle" />
                <cspan paddingLeft={17} text={lc('speed')} verticalAlignment="middle" />
            </canvaslabel>
            <canvaslabel color={colorOnSurface} row={1}>
                <cgroup verticalAlignment="middle">
                    <cspan fontSize={20} fontWeight="bold" text={speedFormatted[0] || '-'} />
                    <cspan color={colorOnSurfaceVariant} fontSize={12} text={` ${speedFormatted[1]}`} />
                </cgroup>
            </canvaslabel>
        </gridlayout>
        <gridlayout backgroundColor={colorSurfaceFill} borderColor={colorHairline} borderRadius={14} borderWidth={isEInk ? 1 : 0} col={1} margin="0 3" padding="4 12" rows="auto,*">
            <canvaslabel color={colorOnSurfaceVariant} fontSize={11} height={16}>
                <cspan color={isEInk ? colorOnSurface : colorPrimary} fontFamily={$fonts.mdi} fontSize={13} text={listeningForBarometer ? 'mdi-gauge' : 'mdi-altimeter'} verticalAlignment="middle" />
                <cspan paddingLeft={17} text={listeningForBarometer ? lc('barometer') : lc('altitude')} verticalAlignment="middle" />
            </canvaslabel>
            <canvaslabel color={colorOnSurface} row={1}>
                <cgroup verticalAlignment="middle">
                    <cspan fontSize={20} fontWeight="bold" text={altitudeFormatted[0] || '-'} />
                    <cspan color={colorOnSurfaceVariant} fontSize={12} text={` ${altitudeFormatted[1]}`} />
                </cgroup>
                <cspan fontSize={9} text={listeningForBarometer ? airportRefName : null} textAlignment="right" verticalAlignment="bottom" />
            </canvaslabel>
        </gridlayout>
        {#if hasBarometer}
            <stacklayout col={2} verticalAlignment="middle">
                <IconButton color={colorOnSurfaceVariant} isSelected={listeningForBarometer} small={true} text="mdi-gauge" tooltip={lc('barometer')} on:tap={switchBarometer} />
                <IconButton color={colorOnSurfaceVariant} isVisible={listeningForBarometer} small={true} text="mdi-reflect-vertical" on:tap={getNearestAirportPressure} />
            </stacklayout>
        {/if}
    {/if}
</gridlayout>
