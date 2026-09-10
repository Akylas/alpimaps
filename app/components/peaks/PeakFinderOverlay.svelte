<script lang="ts">
    /**
     * The peak finder's on-screen chrome.
     *
     * The same controls the WebView version had — a viewpoint-elevation slider down the left, the
     * selected summit as a chip with a fly-to, and a row of round buttons — except that everything here
     * writes a store and the module does the work, instead of `executeJavaScript` into a page.
     *
     * Rendered by `Map.svelte` over the map, and only mounted the first time the mode is entered.
     */
    import { Utils } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { applyViewpointElevation, exitPeakFinder, flyToSelectedPeak, focusSelectedPeak, showPeakFinderSettings, toggleArMode, toggleHeadingFollowing } from '~/mapModules/features/peakFinder';
    import { getMapContext } from '~/mapModules/MapModule';
    import { peakFinderActive, peakFinderArActive, peakFinderDark, peakFinderElevation, peakFinderHeadingFollowing, peakFinderSelectedPeak } from '~/stores/terrainStore';
    import { clearInterval, setInterval } from '~/utils/utils';
    import { showToolTip } from '@shared/utils/ui';
    import { colors, fonts, windowInset } from '~/variables';

    $: ({ colorOnSurface, colorPrimary } = $colors);

    /** Height of the rotated elevation slider, worked out from the view it sits in. */
    let sliderHeight = 0;
    function onLayoutChanged(event) {
        sliderHeight = 0.6 * Utils.layout.toDeviceIndependentPixels(event.object.getMeasuredHeight());
    }

    function truncate(text: string, maxLength: number) {
        return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
    }

    /**
     * While the fly-in runs, the elevation readout follows the FLIGHT rather than a clock of its own —
     * the camera is climbing, and a number that ignored that would disagree with the view.
     */
    let flightTimer = null;
    function followFlight() {
        stopFollowingFlight();
        flightTimer = setInterval(() => {
            const camera = getMapContext().getMap()?.camera();
            if (!camera || camera.progress() < 0) {
                stopFollowingFlight();
                return;
            }
            const altitude = camera.position()[2];
            if (altitude !== undefined) {
                peakFinderElevation.set(Math.round(altitude));
            }
        }, 100);
    }
    function stopFollowingFlight() {
        if (flightTimer) {
            clearInterval(flightTimer);
            flightTimer = null;
        }
    }
    $: if ($peakFinderActive) {
        followFlight();
    } else {
        stopFollowingFlight();
    }
    onDestroy(stopFollowingFlight);

    /** The slider owns the elevation once the user touches it, so the flight's own follow stops. */
    function onElevationChange(event) {
        stopFollowingFlight();
        const value = Math.round(event.value);
        peakFinderElevation.set(value);
        applyViewpointElevation(value);
    }
</script>

<gridlayout isPassThroughParentEnabled={true} on:layoutChanged={onLayoutChanged} {...$$restProps}>
    <!-- the viewpoint elevation, rotated so it reads bottom-to-top like an altitude scale -->
    <slider
        style={`transform: rotate(-90) translate(20,${sliderHeight * 0.5})`}
        horizontalAlignment="left"
        marginLeft={$windowInset.left}
        maxValue={6000}
        minValue={0}
        originX={0}
        value={$peakFinderElevation}
        verticalAlignment="middle"
        width={sliderHeight}
        on:valueChange={onElevationChange} />
    <label
        color={colorOnSurface}
        fontSize={12}
        horizontalAlignment="left"
        marginBottom={10}
        marginLeft={$windowInset.left + 10}
        text={`${Math.round($peakFinderElevation)} m`}
        verticalAlignment="bottom" />

    <!-- the summit the user tapped: tap the name to turn towards it, the plane to go there -->
    <gridlayout
        backgroundColor="#4465be94"
        borderRadius={20}
        columns="*,auto"
        height={40}
        horizontalAlignment="center"
        marginBottom={50}
        padding={5}
        verticalAlignment="bottom"
        visibility={$peakFinderSelectedPeak ? 'visible' : 'hidden'}
        width="60%">
        <canvaslabel color="white" fontSize={13} paddingLeft={10} on:tap={() => focusSelectedPeak()}>
            <cgroup verticalAlignment="middle" verticalTextAlignment="center">
                <cspan fontWeight="bold" text={$peakFinderSelectedPeak && truncate($peakFinderSelectedPeak.name, 25)} />
                <cspan
                    text={$peakFinderSelectedPeak &&
                        ` ${$peakFinderSelectedPeak.elevation !== undefined ? `${$peakFinderSelectedPeak.elevation}m` : ''}(${formatDistance($peakFinderSelectedPeak.distance)})`} />
            </cgroup>
        </canvaslabel>
        <mdbutton col={1} color="white" fontFamily={$fonts.app} text="alpimaps-paper-plane" variant="text" width={40} on:tap={() => flyToSelectedPeak()} />
    </gridlayout>

    <!-- tooltips on long press, the way IconButton does it: there is no `tooltip` attribute on a button -->
    <stacklayout horizontalAlignment="left" marginBottom={$windowInset.bottom} marginLeft={$windowInset.left + 30} orientation="horizontal" verticalAlignment="bottom">
        <mdbutton
            class="small-floating-btn"
            color={$peakFinderHeadingFollowing ? colorPrimary : colorOnSurface}
            text="mdi-compass"
            on:tap={() => toggleHeadingFollowing()}
            on:longPress={() => showToolTip(lc('compass'))} />
        <mdbutton
            class="small-floating-btn"
            color={$peakFinderDark ? colorPrimary : colorOnSurface}
            text="mdi-theme-light-dark"
            on:tap={() => peakFinderDark.set(!$peakFinderDark)}
            on:longPress={() => showToolTip(lc('dark_mode'))} />
        <mdbutton
            class="small-floating-btn"
            color={$peakFinderArActive ? colorPrimary : colorOnSurface}
            text="mdi-camera"
            on:tap={() => toggleArMode()}
            on:longPress={() => showToolTip(lc('ar_mode'))} />
        <mdbutton class="small-floating-btn" color={colorOnSurface} text="mdi-cog" on:tap={() => showPeakFinderSettings()} on:longPress={() => showToolTip(lc('settings'))} />
        <mdbutton class="small-floating-btn" color={colorOnSurface} text="mdi-close" on:tap={() => exitPeakFinder()} on:longPress={() => showToolTip(lc('close'))} />
    </stacklayout>

    <!-- the compass needs calibrating: the same hint the WebView version showed -->
    <activityindicator busy={true} horizontalAlignment="right" marginBottom={$windowInset.bottom} verticalAlignment="bottom" visibility={$peakFinderHeadingFollowing ? 'visible' : 'collapse'} />
</gridlayout>
