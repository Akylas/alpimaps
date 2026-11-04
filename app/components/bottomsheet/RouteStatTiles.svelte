<script lang="ts">
    // the route's totals as compact tiles, an icon for a label; on the route, each also shows what is
    // left to the end, behind the finish flag, in the accent
    import { View } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { onDestroy } from 'svelte';
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { isEInk } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { Item } from '~/models/Item';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type LensId, routeFeatures, routeLenses, routeTiles } from '~/routeFeatures/registry';
    import { showToolTip } from '~/utils/ui';
    import { colors, fonts } from '~/variables';

    export let item: Item;
    /** the sheet's width: a narrow one has no room for the icon of the first tiles */
    export let sheetWidth: number;

    // no payload: the listener gets `undefined`
    interface $$Events {
        lens: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();
    const NARROW_WIDTH = 360;

    let { colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);

    let remaining: { distance?: string; time?: string; ascent?: string } = null;

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
            ascent: data && !isNaN(data.dp) && event.dplus - data.dp > 0 ? convertElevation(event.dplus - data.dp) : null
        };
    }
    const itemsModule = getMapContext().mapModule('items');
    itemsModule.on('user_onroute_data', onRouteData);
    onDestroy(() => itemsModule.off('user_onroute_data', onRouteData));
    $: if (item) {
        remaining = null;
    }

    $: tiles = routeTiles($routeFeatures, { item });
    $: narrow = sheetWidth < NARROW_WIDTH;

    // a tile with a lens reads the route in it, and the sheet shows the card that has it
    function showLens(id: LensId) {
        if (routeLenses($routeFeatures, { item }).some((lens) => lens.id === id)) {
            selectLens(id);
            dispatch('lens');
        }
    }
</script>

<gridlayout columns={tiles.map((tile) => (tile.weight ?? 1) + '*').join(',') || '*'} height={40} padding="0 7" {...$$restProps}>
    {#each tiles as tile, index}
        <!-- the second line: what is left to the end for the selected point, else the tile's own -->
        {@const hideIcon = narrow && (tile.key === 'distance' || tile.key === 'time')}
        {@const second = remaining?.[tile.key] ? { icon: 'mdi-flag-checkered', text: remaining[tile.key], remaining: true } : tile.sub && { ...tile.sub, remaining: false }}
        <gridlayout
            backgroundColor={colorSurfaceFill}
            borderColor={colorHairline}
            borderRadius={10}
            borderWidth={isEInk ? 1 : 0}
            col={index}
            margin="0 3"
            padding="0 6"
            rippleColor={tile.lens ? colorPrimary : null}
            rows="*,auto"
            verticalAlignment="stretch"
            on:tap={() => tile.lens && showLens(tile.lens)}
            on:longPress={(event) => event.object instanceof View && showToolTip(tile.label, event.object)}>
            <canvaslabel fontSize={14} height={18} rowSpan={second ? 1 : 2} verticalAlignment={second ? 'bottom' : 'middle'}>
                <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text={hideIcon ? '' : tile.icon} verticalAlignment="middle" />
                <cspan color={colorOnSurface} fontWeight="bold" paddingLeft={hideIcon ? 0 : 17} text={tile.value} verticalAlignment="middle" />
            </canvaslabel>
            {#if second}
                {@const color = second.remaining ? (isEInk ? colorOnSurface : colorPrimary) : colorOnSurfaceVariant}
                <canvaslabel fontSize={11} height={15} row={1} verticalAlignment="top">
                    <cspan {color} fontFamily={$fonts.mdi} fontSize={11} text={second.icon} verticalAlignment="middle" />
                    <cspan {color} fontWeight={second.remaining ? 'bold' : 'normal'} paddingLeft={14} text={second.text} verticalAlignment="middle" />
                </canvaslabel>
            {/if}
        </gridlayout>
    {/each}
</gridlayout>
