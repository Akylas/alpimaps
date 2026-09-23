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
    import { getCompassInfo } from '~/helpers/geolib';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { applyViewpointElevation, exitPeakFinder, flyToSelectedPeak, focusSelectedPeak, showPeakFinderSettings, toggleArMode, toggleHeadingFollowing } from '~/mapModules/features/peakFinder';
    import {
        PEAK_FINDER_ELEVATION_GROWTH,
        PEAK_FINDER_ELEVATION_MAX,
        PEAK_FINDER_ELEVATION_RATE,
        PEAK_FINDER_ELEVATION_RATE_MAX,
        PEAK_FINDER_ELEVATION_STEP,
        peakFinderArActive,
        peakFinderDark,
        peakFinderElevation,
        peakFinderHeading,
        peakFinderHeadingFollowing,
        peakFinderMinElevation,
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

    /**
     * Where the view is pointed, as a needle and a bearing.
     *
     * The needle points NORTH — it is a compass, not a heading arrow — so it is turned by MINUS the
     * view's own bearing: looking east puts north to the left of the screen. The text is the other
     * half, the direction being looked AT, which is what a panorama is read by.
     */
    $: compass = getCompassInfo($peakFinderHeading);

    function truncate(text: string, maxLength: number) {
        return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
    }

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
        const value = Math.max($peakFinderMinElevation, Math.min(PEAK_FINDER_ELEVATION_MAX, $peakFinderElevation + delta));
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
            // GEOMETRIC, on the current height rather than on how long the arrow has been held: the
            // further up the eye already is, the faster it moves. A constant fraction per second, so
            // one drag covers the same proportion of the climb from 50 m as it does from 5 km.
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

    <!-- where the view is pointed: the needle holds north, the text is the direction being looked at.
         Top left, which is the one corner this mode leaves empty - the summit labels are pinned under
         the top edge and the buttons hang bottom left. -->
    <stacklayout
        backgroundColor={colorWidgetBackground}
        borderRadius={26}
        horizontalAlignment="left"
        marginLeft={$windowInset.left + 10}
        marginTop={$windowInset.top + 10}
        padding="6 8"
        verticalAlignment="top">
        <label
            color={$peakFinderHeadingFollowing ? colorPrimary : colorOnSurface}
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
