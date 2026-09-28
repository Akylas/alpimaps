<script lang="ts">
    /**
     * The sky panel: what is drawn over the panorama - the sun, the moon, the stars and what goes
     * with each - and for which moment.
     *
     * A card at the bottom rather than a modal sheet, so the panorama stays live behind it: turn,
     * scrub the time, and watch the sky move. On the panorama's own palette, like the rest of the
     * chrome.
     */
    import PeakFinderSkyTime from '~/components/peaks/PeakFinderSkyTime.svelte';
    import PeakFinderSkyToggle from '~/components/peaks/PeakFinderSkyToggle.svelte';
    import { formatDate, formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import {
        peakFinderConstellations,
        peakFinderDarkActive,
        peakFinderMoon,
        peakFinderPlanets,
        peakFinderSkyPanel,
        peakFinderSkyTime,
        peakFinderStars,
        peakFinderSun,
        peakFinderSunHours
    } from '~/stores/terrainStore';
    import { fonts } from '~/variables';

    export let colorOnSurface: string;
    export let colorWidgetBackground: string;

    // Nearly opaque, over the relief's lines: the chrome's translucency is for small things.
    $: colorPanelBackground = isEInk ? colorWidgetBackground : colorWidgetBackground.slice(0, 7) + 'f7';
    // Amber: the sun's colour on the panorama, and what reads on both the pale and the night sky.
    $: colorAccent = isEInk ? colorOnSurface : $peakFinderDarkActive ? '#fbbf24' : '#b45309';
    $: colorAccentContainer = isEInk ? 'transparent' : $peakFinderDarkActive ? '#fbbf2429' : '#b453091f';
    $: colorOnSurfaceVariant = colorOnSurface + 'b3';
    $: toggleColors = { colorOnSurface, colorAccent, colorAccentContainer };

    $: summary = $peakFinderSkyTime === null ? lc('now') : `${formatDate($peakFinderSkyTime, 'll')} · ${formatTime($peakFinderSkyTime)}`;
</script>

<gridlayout
    backgroundColor={colorPanelBackground}
    borderColor={isEInk ? colorOnSurface : colorOnSurface + '1f'}
    borderRadius={24}
    borderWidth={1}
    padding="10 12 8 12"
    rows="auto,auto,auto,auto"
    {...$$restProps}>
    <!-- header: what it is, the moment drawn, and the way out -->
    <gridlayout columns="auto,*,auto" paddingLeft={4}>
        <label color={colorAccent} fontFamily={$fonts.mdi} fontSize={22} text="mdi-star-shooting" verticalAlignment="middle" />
        <stacklayout col={1} paddingLeft={10} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={17} fontWeight="bold" text={lc('sky')} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={summary} />
        </stacklayout>
        <mdbutton col={2} color={colorOnSurface} fontFamily={$fonts.mdi} fontSize={20} text="mdi-chevron-down" variant="text" width={44} on:tap={() => peakFinderSkyPanel.set(false)} />
    </gridlayout>

    <!-- the bodies -->
    <gridlayout columns="*,*,*" marginTop={6} row={1}>
        <PeakFinderSkyToggle icon="mdi-white-balance-sunny" label={lc('sun')} store={peakFinderSun} {...toggleColors} />
        <PeakFinderSkyToggle col={1} icon="mdi-moon-waning-crescent" label={lc('moon')} store={peakFinderMoon} {...toggleColors} />
        <PeakFinderSkyToggle col={2} icon="mdi-star-four-points" label={lc('stars')} store={peakFinderStars} {...toggleColors} />
    </gridlayout>

    <!-- what goes with them, only while they are on -->
    <wraplayout horizontalAlignment="center" marginTop={2} row={2} visibility={$peakFinderSun || $peakFinderStars ? 'visible' : 'collapse'}>
        <PeakFinderSkyToggle icon="mdi-clock-outline" label={lc('hours')} small={true} store={peakFinderSunHours} visibility={$peakFinderSun ? 'visible' : 'collapse'} {...toggleColors} />
        <PeakFinderSkyToggle
            icon="mdi-vector-polyline"
            label={lc('constellations')}
            small={true}
            store={peakFinderConstellations}
            visibility={$peakFinderStars ? 'visible' : 'collapse'}
            {...toggleColors} />
        <PeakFinderSkyToggle icon="mdi-orbit" label={lc('planets')} small={true} store={peakFinderPlanets} visibility={$peakFinderStars ? 'visible' : 'collapse'} {...toggleColors} />
    </wraplayout>

    <PeakFinderSkyTime {colorOnSurface} {colorOnSurfaceVariant} colorPrimary={colorAccent} marginTop={4} row={3} />
</gridlayout>
