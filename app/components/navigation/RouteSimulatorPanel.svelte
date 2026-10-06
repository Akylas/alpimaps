<script context="module" lang="ts">
    // kept across navigations: where the panel was dragged to
    let savedX = 0;
    let savedY = 0;
</script>

<script lang="ts">
    import { GestureStateTypes, type PanGestureEventData } from '@nativescript/core';
    import IconButton from '~/components/common/IconButton.svelte';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { changeSimulatedSpeed, jumpToManeuver, routeSimulation, stopRouteSimulation, toggleSimulatedOffRoute, toggleSimulationPaused } from '~/services/RouteSimulator';
    import { colors, fonts } from '~/variables';

    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    // dev only, so not translated
    const BUTTON = 40;

    let translateX = savedX;
    let translateY = savedY;
    let startX = 0;
    let startY = 0;
    // a pan from the handle only: started on a button, it would fight the button's tap
    function onPan(event: PanGestureEventData) {
        if (event.state === GestureStateTypes.began) {
            startX = translateX;
            startY = translateY;
        }
        translateX = savedX = startX + event.deltaX;
        translateY = savedY = startY + event.deltaY;
    }
</script>

<!-- dev only: the route simulator's remote, shown while it runs, dragged by its handle -->
<NavigationCard columns="auto,auto" padding="2 4 2 0" rows="auto,auto" {translateX} {translateY} visibility={$routeSimulation ? 'visible' : 'collapse'} {...$$restProps}>
    <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={22} rowSpan={2} text="mdi-drag" verticalAlignment="middle" width={28} on:pan={onPan} />
    <stacklayout col={1} orientation="horizontal">
        <IconButton color={colorOnSurface} maxFontScale={1} size={BUTTON} text="mdi-skip-previous" tooltip="previous maneuver" on:tap={() => jumpToManeuver(-1)} />
        <IconButton color={colorPrimary} maxFontScale={1} size={BUTTON} text={$routeSimulation?.paused ? 'mdi-play' : 'mdi-pause'} tooltip="pause simulation" on:tap={toggleSimulationPaused} />
        <IconButton color={colorOnSurface} maxFontScale={1} size={BUTTON} text="mdi-skip-next" tooltip="next maneuver" on:tap={() => jumpToManeuver(1)} />
        <IconButton color={colorError} maxFontScale={1} size={BUTTON} text="mdi-stop" tooltip="stop simulation" on:tap={stopRouteSimulation} />
    </stacklayout>
    <stacklayout col={1} orientation="horizontal" row={1}>
        <IconButton color={colorOnSurface} maxFontScale={1} size={BUTTON} text="mdi-minus" tooltip="slower" on:tap={() => changeSimulatedSpeed(-1)} />
        <label color={colorOnSurfaceVariant} fontSize={13} text={($routeSimulation?.speedKmh ?? 0) + ' km/h'} textAlignment="center" verticalAlignment="middle" width={60} />
        <IconButton color={colorOnSurface} maxFontScale={1} size={BUTTON} text="mdi-plus" tooltip="faster" on:tap={() => changeSimulatedSpeed(1)} />
        <IconButton
            color={$routeSimulation?.offRoute ? colorError : colorOnSurfaceVariant}
            maxFontScale={1}
            size={BUTTON}
            text="mdi-call-split"
            tooltip="go off route"
            on:tap={toggleSimulatedOffRoute} />
    </stacklayout>
</NavigationCard>
