<script lang="ts">
    // the route's totals as labelled tiles; on the route, each also shows what is left, in the accent
    import { onDestroy } from 'svelte';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { colors } from '~/variables';

    export let item: Item;

    let { colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);

    let remaining: { distance?: string; time?: string; ascent?: string; descent?: string } = null;

    // the same event the elevation chart feeds, from a tap on it or a location on the route
    function onRouteData(event) {
        if (!event.remainingDistance) {
            remaining = null;
            return;
        }
        const data = event.itemData;
        remaining = {
            distance: formatDistance(event.remainingDistance),
            time: !isNaN(event.remainingTime) ? convertDurationSeconds(event.remainingTime) : null,
            ascent: data && !isNaN(data.dp) && event.dplus - data.dp > 0 ? convertElevation(event.dplus - data.dp) : null,
            descent: data && !isNaN(data.dm) && Math.abs(event.dmin - data.dm) > 0 ? convertElevation(-(event.dmin - data.dm)) : null
        };
    }
    const itemsModule = getMapContext().mapModule('items');
    itemsModule.on('user_onroute_data', onRouteData);
    onDestroy(() => itemsModule.off('user_onroute_data', onRouteData));
    $: if (item) {
        remaining = null;
    }

    function tilesFor(it: Item) {
        const route = it?.route;
        if (!route) {
            return [];
        }
        const properties = it.properties;
        const profile = it.profile;
        const hasProfile = !!profile?.max;
        const distance = route.totalDistance || (properties?.distance ? properties.distance * 1000 : 0);
        const ascent = hasProfile ? profile.dplus : properties?.ascent;
        const descent = hasProfile ? -profile.dmin : properties?.descent;
        return [
            distance > 0 && { key: 'distance', label: lc('distance'), value: formatDistance(distance) },
            route.totalTime > 0 && { key: 'time', label: lc('duration'), value: convertDurationSeconds(route.totalTime) },
            ascent > 0 && { key: 'ascent', label: lc('ascent'), value: convertElevation(ascent) },
            descent > 0 && { key: 'descent', label: lc('descent'), value: convertElevation(descent) }
        ].filter(Boolean);
    }
    $: tiles = tilesFor(item);
</script>

<gridlayout columns={tiles.map(() => '*').join(',') || '*'} padding="0 9 0 9" {...$$restProps}>
    {#each tiles as tile, index}
        <stacklayout backgroundColor={colorSurfaceFill} borderColor={colorHairline} borderRadius={12} borderWidth={isEInk ? 1 : 0} col={index} margin="0 3" padding="6 10">
            <label color={colorOnSurfaceVariant} fontSize={12} maxLines={1} text={tile.label} />
            <label color={colorOnSurface} fontSize={16} fontWeight="bold" maxLines={1} text={tile.value} />
            <label
                color={isEInk ? colorOnSurface : colorPrimary}
                fontSize={11}
                fontWeight="bold"
                maxLines={1}
                text={remaining?.[tile.key] ? `${remaining[tile.key]} ${lc('left')}` : ''}
                visibility={remaining?.[tile.key] ? 'visible' : 'collapse'} />
        </stacklayout>
    {/each}
</gridlayout>
