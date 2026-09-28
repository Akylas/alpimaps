<script lang="ts">
    // Peak finder chrome: everything here writes a store and the module does the work.
    // Mounted by `Map.svelte` only the first time the mode is entered.
    import { onDestroy } from 'svelte';
    import PeakFinderSkyPanel from '~/components/peaks/PeakFinderSkyPanel.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { getCompassInfo } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { applyViewpointElevation, exitPeakFinder, flyToSelectedPeak, showPeakFinderSettings, toggleArMode, toggleHeadingFollowing } from '~/mapModules/features/peakFinder';
    import { openSkyWikipedia } from '~/mapModules/features/peakFinderCelestial';
    import {
        PEAK_FINDER_ELEVATION_GROWTH,
        PEAK_FINDER_ELEVATION_MAX,
        PEAK_FINDER_ELEVATION_RATE,
        PEAK_FINDER_ELEVATION_RATE_MAX,
        PEAK_FINDER_ELEVATION_STEP,
        peakFinderArActive,
        peakFinderArDark,
        peakFinderCalibrationNeeded,
        peakFinderDark,
        peakFinderDarkActive,
        peakFinderElevation,
        peakFinderHeading,
        peakFinderHeadingFollowing,
        peakFinderMinElevation,
        peakFinderSelectedPeak,
        peakFinderSelectedSky,
        peakFinderSkyPanel
    } from '~/stores/terrainStore';
    import { clearInterval, setInterval } from '~/utils/utils';
    import { showToolTip } from '@shared/utils/ui';
    import { fonts, screenHeightDips, screenWidthDips, windowInset } from '~/variables';

    // The panorama's light/dark style, not the app theme's: the chrome sits on the panorama.
    $: colorOnSurface = $peakFinderDarkActive ? '#ffffff' : '#18181b';
    // Opaque on e-ink, which dithers alpha.
    $: colorWidgetBackground = $peakFinderDarkActive ? (isEInk ? '#000000' : '#18181be6') : isEInk ? '#ffffff' : '#ffffffe6';

    // e-ink dithers alpha and greys colours: black on white, outlined since the relief under it is white too
    const peakChipBackground = isEInk ? 'white' : '#4465be94';
    const peakChipColor = isEInk ? 'black' : 'white';
    const peakChipBorderWidth = isEInk ? 1 : 0;

    // The shorter side, so the panel fits either way the phone is held.
    const skyPanelWidth = Math.min(460, Math.min(screenWidthDips, screenHeightDips) - 24);
    $: skyAccent = isEInk ? colorOnSurface : $peakFinderDarkActive ? '#fbbf24' : '#b45309';

    $: compass = getCompassInfo($peakFinderHeading);

    let skyPanelMounted = false;
    $: skyPanelMounted = skyPanelMounted || $peakFinderSkyPanel;

    function truncate(text: string, maxLength: number) {
        return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
    }

    // elevation arrows (as peakfinder.com): tap = one step, hold = accelerating climb,
    // dragging while held takes the direction over from the arrow that was pressed
    const ELEVATION_TICK_MS = 50;
    /** Before the continuous climb starts, so a tap stays a single step. */
    const ELEVATION_HOLD_DELAY_MS = 300;
    /** How far the finger has to travel before it, and not the arrow, decides the direction (dip). */
    const ELEVATION_DRAG_THRESHOLD = 12;

    let holdTimer = null;
    let holdDirection = 0;
    let holdStartY = 0;
    let holdSeconds = 0;

    function changeElevation(delta: number) {
        const value = Math.max($peakFinderMinElevation, Math.min(PEAK_FINDER_ELEVATION_MAX, $peakFinderElevation + delta));
        if (value === $peakFinderElevation) {
            return;
        }
        peakFinderElevation.set(value);
        // a terrain property write, not a camera move, so it lands on the next frame
        applyViewpointElevation(value);
    }

    function startHolding(direction: number) {
        stopHolding();
        holdDirection = direction;
        holdSeconds = 0;
        holdTimer = setInterval(() => {
            holdSeconds += ELEVATION_TICK_MS / 1000;
            if (holdSeconds * 1000 < ELEVATION_HOLD_DELAY_MS) {
                return;
            }
            // geometric on the current height, not on hold time: a constant fraction per second
            const rate = Math.min(PEAK_FINDER_ELEVATION_RATE_MAX, PEAK_FINDER_ELEVATION_RATE + $peakFinderElevation * PEAK_FINDER_ELEVATION_GROWTH);
            changeElevation((holdDirection * rate * ELEVATION_TICK_MS) / 1000);
        }, ELEVATION_TICK_MS);
    }

    function stopHolding() {
        if (holdTimer) {
            clearInterval(holdTimer);
            holdTimer = null;
        }
        holdDirection = 0;
    }
    onDestroy(stopHolding);

    function onElevationTouch(event, direction: number) {
        switch (event.action) {
            case 'down':
                holdStartY = event.getY();
                changeElevation(direction * PEAK_FINDER_ELEVATION_STEP);
                startHolding(direction);
                break;
            case 'move': {
                // Screen y grows downwards, so a finger moving UP is a positive travel.
                const travel = holdStartY - event.getY();
                if (Math.abs(travel) > ELEVATION_DRAG_THRESHOLD) {
                    holdDirection = travel > 0 ? 1 : -1;
                }
                break;
            }
            default:
                stopHolding();
                break;
        }
    }
</script>

<!-- two rows only while the sky panel is open: it takes the bottom, the controls centre above it -->
<gridlayout isPassThroughParentEnabled={true} rows="*,auto" {...$$restProps}>
    <stacklayout backgroundColor={colorWidgetBackground} borderRadius={22} horizontalAlignment="right" marginRight={$windowInset.right + 10} padding="6 4" verticalAlignment="middle">
        <label
            color={colorOnSurface}
            fontFamily={$fonts.mdi}
            fontSize={26}
            height={40}
            text="mdi-chevron-up"
            textAlignment="center"
            verticalTextAlignment="center"
            width={48}
            on:touch={(event) => onElevationTouch(event, 1)} />
        <label color={colorOnSurface} fontSize={12} text={`+${Math.round($peakFinderElevation)} m`} textAlignment="center" width={48} />
        <label
            color={colorOnSurface}
            fontFamily={$fonts.mdi}
            fontSize={26}
            height={40}
            text="mdi-chevron-down"
            textAlignment="center"
            verticalTextAlignment="center"
            width={48}
            on:touch={(event) => onElevationTouch(event, -1)} />
    </stacklayout>

    <stacklayout marginBottom={$peakFinderSkyPanel ? $windowInset.bottom + 8 : 50} row={$peakFinderSkyPanel ? 1 : 0} rowSpan={$peakFinderSkyPanel ? 1 : 2} verticalAlignment="bottom">
        <gridlayout
            backgroundColor={peakChipBackground}
            borderColor={peakChipColor}
            borderRadius={20}
            borderWidth={peakChipBorderWidth}
            columns="*,auto"
            height={50}
            horizontalAlignment="center"
            marginBottom={8}
            padding={5}
            visibility={$peakFinderSelectedPeak ? 'visible' : 'collapse'}
            width="60%">
            <canvaslabel color={peakChipColor} fontSize={13} paddingLeft={10}>
                <cgroup verticalAlignment="middle" verticalTextAlignment="center">
                    <cspan fontWeight="bold" text={$peakFinderSelectedPeak && truncate($peakFinderSelectedPeak.name, 25)} />
                    <cspan
                        text={$peakFinderSelectedPeak &&
                            ` ${$peakFinderSelectedPeak.elevation !== undefined ? `${$peakFinderSelectedPeak.elevation}m` : ''}(${formatDistance($peakFinderSelectedPeak.distance)})`} />
                </cgroup>
            </canvaslabel>
            <mdbutton col={1} color={peakChipColor} fontFamily={$fonts.app} text="alpimaps-paper-plane" variant="text" width={40} on:tap={() => flyToSelectedPeak()} />
        </gridlayout>

        <gridlayout
            backgroundColor={colorWidgetBackground}
            borderColor={skyAccent}
            borderRadius={22}
            borderWidth={1}
            columns="auto,*,auto"
            height={54}
            horizontalAlignment="center"
            marginBottom={8}
            padding="4 4 4 14"
            visibility={$peakFinderSelectedSky ? 'visible' : 'collapse'}
            width={Math.min(skyPanelWidth, 340)}>
            <label color={skyAccent} fontFamily={$fonts.mdi} fontSize={20} text="mdi-star-four-points" verticalAlignment="middle" />
            <stacklayout col={1} paddingLeft={10} verticalAlignment="middle">
                <label color={colorOnSurface} fontSize={15} fontWeight="bold" maxLines={1} text={$peakFinderSelectedSky?.name ?? ''} />
                <label color={colorOnSurface + 'b3'} fontSize={12} maxLines={1} text={$peakFinderSelectedSky?.detail ?? ''} visibility={$peakFinderSelectedSky?.detail ? 'visible' : 'collapse'} />
            </stacklayout>
            <mdbutton
                col={2}
                color={colorOnSurface}
                fontFamily={$fonts.mdi}
                fontSize={22}
                text="mdi-wikipedia"
                variant="text"
                width={46}
                on:tap={() => $peakFinderSelectedSky && openSkyWikipedia($peakFinderSelectedSky)}
                on:longPress={() => showToolTip(lc('open_wikipedia'))} />
        </gridlayout>

        <!-- mounted the first time it opens, then only hidden: scrubbing the sky should not rebuild it -->
        {#if skyPanelMounted}
            <PeakFinderSkyPanel {colorOnSurface} {colorWidgetBackground} horizontalAlignment="center" visibility={$peakFinderSkyPanel ? 'visible' : 'collapse'} width={skyPanelWidth} />
        {/if}
    </stacklayout>

    <!-- An active toggle shows its filled icon, its outline one otherwise: a tint is invisible on e-ink.
         Centred: at the bottom the last button fell under the navigation bar. -->
    <stacklayout horizontalAlignment="left" marginLeft={$windowInset.left + 4} orientation="vertical" verticalAlignment="middle">
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={colorOnSurface}
            text={$peakFinderHeadingFollowing ? 'mdi-compass' : 'mdi-compass-outline'}
            on:tap={() => toggleHeadingFollowing()}
            on:longPress={() => showToolTip(lc('compass'))} />
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={colorOnSurface}
            text="mdi-theme-light-dark"
            on:tap={() => ($peakFinderArActive ? peakFinderArDark.set(!$peakFinderArDark) : peakFinderDark.set(!$peakFinderDark))}
            on:longPress={() => showToolTip(lc('dark_mode'))} />
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={colorOnSurface}
            text={$peakFinderArActive ? 'mdi-camera' : 'mdi-camera-outline'}
            on:tap={() => toggleArMode()}
            on:longPress={() => showToolTip(lc('ar_mode'))} />
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={$peakFinderSkyPanel ? skyAccent : colorOnSurface}
            text={$peakFinderSkyPanel ? 'mdi-star-shooting' : 'mdi-star-shooting-outline'}
            on:tap={() => peakFinderSkyPanel.set(!$peakFinderSkyPanel)}
            on:longPress={() => showToolTip(lc('sky'))} />
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={colorOnSurface}
            text="mdi-cog"
            on:tap={() => showPeakFinderSettings()}
            on:longPress={() => showToolTip(lc('settings'))} />
        <mdbutton
            backgroundColor={colorWidgetBackground}
            class="small-floating-btn"
            color={colorOnSurface}
            text="mdi-close"
            on:tap={() => exitPeakFinder()}
            on:longPress={() => showToolTip(lc('close'))} />
    </stacklayout>

    <mdbutton
        backgroundColor="orange"
        class="small-floating-btn"
        color="white"
        fontFamily={$fonts.app}
        horizontalAlignment="right"
        marginBottom={$windowInset.bottom + 10}
        marginRight={$windowInset.right + 10}
        rowSpan={2}
        text="alpimaps-compass-calibrate"
        verticalAlignment="bottom"
        visibility={$peakFinderCalibrationNeeded ? 'visible' : 'collapse'}
        on:tap={() => showToolTip(lc('calibration_needed'))} />

    <!-- the needle holds north (compass, not heading arrow), so it turns by minus the view bearing -->
    <stacklayout
        backgroundColor={colorWidgetBackground}
        borderRadius={26}
        horizontalAlignment="left"
        marginLeft={$windowInset.left + 10}
        marginTop={$windowInset.top + 10}
        padding="6 8"
        verticalAlignment="top">
        <label
            color={colorOnSurface}
            fontFamily={$fonts.mdi}
            fontSize={28}
            height={32}
            rotate={-$peakFinderHeading}
            text="mdi-navigation"
            textAlignment="center"
            verticalTextAlignment="center"
            width={36} />
        <label color={colorOnSurface} fontSize={11} text={`${Math.round($peakFinderHeading)}° ${compass.exact}`} textAlignment="center" width={36} />
    </stacklayout>
</gridlayout>
