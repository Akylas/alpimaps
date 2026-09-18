<script lang="ts">
    /**
     * The peak finder's on-screen chrome.
     *
     * The same controls the WebView version had — the viewpoint's elevation, the selected summit as a
     * chip with a fly-to, and a row of round buttons — except that everything here writes a store and
     * the module does the work, instead of `executeJavaScript` into a page.
     *
     * Rendered by `Map.svelte` over the map, and only mounted the first time the mode is entered.
     */
    import { onDestroy } from 'svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import {
        applyViewpointElevation,
        currentViewpointElevation,
        exitPeakFinder,
        flyToSelectedPeak,
        focusSelectedPeak,
        showPeakFinderSettings,
        toggleArMode,
        toggleHeadingFollowing
    } from '~/mapModules/features/peakFinder';
    import { getMapContext } from '~/mapModules/MapModule';
    import {
        PEAK_FINDER_ELEVATION_MAX,
        PEAK_FINDER_ELEVATION_RAMP,
        PEAK_FINDER_ELEVATION_RATE,
        PEAK_FINDER_ELEVATION_RATE_MAX,
        PEAK_FINDER_ELEVATION_STEP,
        peakFinderActive,
        peakFinderArActive,
        peakFinderDark,
        peakFinderElevation,
        peakFinderHeadingFollowing,
        peakFinderSelectedPeak
    } from '~/stores/terrainStore';
    import { clearInterval, setInterval } from '~/utils/utils';
    import { showToolTip } from '@shared/utils/ui';
    import { colors, fonts, windowInset } from '~/variables';

    $: ({ colorOnSurface, colorPrimary, colorWidgetBackground } = $colors);

    /**
     * The selected summit's plate.
     *
     * A translucent blue with white text everywhere except on e-ink, which has neither: alpha is
     * dithered and a colour is a grey. Black on white, with an outline — the relief it sits over is
     * white paper too, so without one the plate has no edge at all.
     */
    const peakChipBackground = isEInk ? 'white' : '#4465be94';
    const peakChipColor = isEInk ? 'black' : 'white';
    const peakChipBorderWidth = isEInk ? 1 : 0;

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
            peakFinderElevation.set(Math.round(currentViewpointElevation()));
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

    /**
     * The viewpoint's elevation, as the two arrows peakfinder.com uses rather than a slider.
     *
     * A slider laid across a panorama is the wrong control twice over: it is horizontal where the
     * quantity is vertical, and its travel maps 9 km onto a few hundred pixels, so nothing finer than
     * ~50 m is reachable. The arrows behave the way that site's do:
     *
     *  - a TAP moves one step (the native demo's 200 m);
     *  - HOLDING one climbs continuously, accelerating the longer it is held, so the same control
     *    reaches both the next ridge and the top of the troposphere;
     *  - DRAGGING while held takes the direction over from the arrow that was pressed — the finger is
     *    already down, and reaching for the other button to come back down is what makes the control
     *    feel like two buttons instead of one axis.
     */
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
        const value = Math.max(0, Math.min(PEAK_FINDER_ELEVATION_MAX, $peakFinderElevation + delta));
        if (value === $peakFinderElevation) {
            return;
        }
        peakFinderElevation.set(value);
        // A terrain property write, not a camera move, so it lands on the next frame — which is what
        // a control that fires many times a second while held wants.
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
            const ramp = Math.min(1, (holdSeconds - ELEVATION_HOLD_DELAY_MS / 1000) / PEAK_FINDER_ELEVATION_RAMP);
            const rate = PEAK_FINDER_ELEVATION_RATE + (PEAK_FINDER_ELEVATION_RATE_MAX - PEAK_FINDER_ELEVATION_RATE) * ramp * ramp;
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
                // The user owns the elevation from here on, so the fly-in's own follow lets go of it.
                stopFollowingFlight();
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

<gridlayout isPassThroughParentEnabled={true} {...$$restProps}>
    <!-- the viewpoint elevation: up, the readout, down - a column on the right edge as in the demo -->
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
        <label color={colorOnSurface} fontSize={12} text={`${Math.round($peakFinderElevation)} m`} textAlignment="center" width={48} />
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

    <!-- the summit the user tapped: tap the name to turn towards it, the plane to go there -->
    <gridlayout
        backgroundColor={peakChipBackground}
        borderColor={peakChipColor}
        borderRadius={20}
        borderWidth={peakChipBorderWidth}
        columns="*,auto"
        height={50}
        horizontalAlignment="center"
        marginBottom={50}
        padding={5}
        verticalAlignment="bottom"
        visibility={$peakFinderSelectedPeak ? 'visible' : 'hidden'}
        width="60%">
        <canvaslabel color={peakChipColor} fontSize={13} paddingLeft={10} on:tap={() => focusSelectedPeak()}>
            <cgroup verticalAlignment="middle" verticalTextAlignment="center">
                <cspan fontWeight="bold" text={$peakFinderSelectedPeak && truncate($peakFinderSelectedPeak.name, 25)} />
                <cspan
                    text={$peakFinderSelectedPeak &&
                        ` ${$peakFinderSelectedPeak.elevation !== undefined ? `${$peakFinderSelectedPeak.elevation}m` : ''}(${formatDistance($peakFinderSelectedPeak.distance)})`} />
            </cgroup>
        </canvaslabel>
        <mdbutton col={1} color={peakChipColor} fontFamily={$fonts.app} text="alpimaps-paper-plane" variant="text" width={40} on:tap={() => flyToSelectedPeak()} />
    </gridlayout>

    <stacklayout horizontalAlignment="left" marginLeft={$windowInset.left + 4} orientation="vertical" verticalAlignment="bottom">
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
