<script lang="ts">
    // the route's totals as compact tiles, an icon for a label; on the route, each also shows what is
    // left to the end, behind the finish flag, in the accent
    import { View } from '@nativescript/core';
    import { onDestroy } from 'svelte';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item } from '~/models/Item';
    import { showToolTip } from '~/utils/ui';
    import { colors, fonts } from '~/variables';

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
            distance > 0 && { key: 'distance', icon: 'mdi-arrow-left-right', label: lc('distance'), value: formatDistance(distance) },
            route.totalTime > 0 && { key: 'time', icon: 'mdi-timer-outline', label: lc('duration'), value: convertDurationSeconds(route.totalTime) },
            ascent > 0 && { key: 'ascent', icon: 'mdi-arrow-top-right', label: lc('ascent'), value: convertElevation(ascent) },
            descent > 0 && { key: 'descent', icon: 'mdi-arrow-bottom-right', label: lc('descent'), value: convertElevation(descent) }
        ].filter(Boolean);
    }
    $: tiles = tilesFor(item);
</script>

<gridlayout columns={tiles.map(() => '*').join(',') || '*'} height={40} padding="0 7" {...$$restProps}>
    {#each tiles as tile, index}
        <gridlayout
            backgroundColor={colorSurfaceFill}
            borderColor={colorHairline}
            borderRadius={10}
            borderWidth={isEInk ? 1 : 0}
            col={index}
            margin="0 3"
            padding="0 6"
            rows="*,auto"
            verticalAlignment="stretch"
            on:longPress={(event) => event.object instanceof View && showToolTip(tile.label, event.object)}>
            <canvaslabel fontSize={14} height={18} rowSpan={remaining?.[tile.key] ? 1 : 2} verticalAlignment={remaining?.[tile.key] ? 'bottom' : 'middle'}>
                <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text={tile.icon} verticalAlignment="middle" />
                <cspan color={colorOnSurface} fontWeight="bold" paddingLeft={17} text={tile.value} verticalAlignment="middle" />
            </canvaslabel>
            {#if remaining?.[tile.key]}
                <canvaslabel fontSize={11} height={15} row={1} verticalAlignment="top">
                    <cspan color={isEInk ? colorOnSurface : colorPrimary} fontFamily={$fonts.mdi} fontSize={11} text="mdi-flag-checkered" verticalAlignment="middle" />
                    <cspan color={isEInk ? colorOnSurface : colorPrimary} fontWeight="bold" paddingLeft={14} text={remaining[tile.key]} verticalAlignment="middle" />
                </canvaslabel>
            {/if}
        </gridlayout>
    {/each}
</gridlayout>
