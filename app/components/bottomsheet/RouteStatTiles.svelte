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
    import { focusKeyOf } from '~/routeFeatures/lens/routeFocusStore';
    import { selectLens } from '~/routeFeatures/lens/routeLensStore';
    import { type LensId, routeFeatures, routeLenses, routeTiles } from '~/routeFeatures/registry';
    import { showToolTip } from '~/utils/ui';
    import { colors, fonts } from '~/variables';

    export let item: Item;
    /** the sheet's width: a narrow one has no room for the icon of the first tiles */
    export let sheetWidth: number;
    /** bumped when the item's analysis changed in place: the arrival under the time follows */
    export let version = 0;

    // no payload: the listener gets `undefined`
    interface $$Events {
        lens: undefined;
        when: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();
    const NARROW_WIDTH = 360;

    let { colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors;
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceFill } = $colors);

    let remaining: { distance?: string; time?: string; ascent?: string } = null;

    // the same event the elevation chart feeds, from a tap on it or a location on the route
    function onRouteData(event) {
        // another route's profile: nothing to do with these tiles
        if (focusKeyOf(event.item) !== focusKeyOf(item)) {
            return;
        }
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

    // `version >= 0` is always true: it reruns this when the analysis changed in place
    $: tiles = version >= 0 ? routeTiles($routeFeatures, { item }) : [];
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
        {@const color = second?.remaining ? (isEInk ? colorOnSurface : colorPrimary) : colorOnSurfaceVariant}
        <gridlayout
            backgroundColor={colorSurfaceFill}
            borderColor={colorHairline}
            borderRadius={10}
            borderWidth={isEInk ? 1 : 0}
            col={index}
            height={40}
            margin="0 3"
            padding="0 6"
            rippleColor={tile.lens || tile.opensWhen ? colorPrimary : null}
            rows="*,auto,auto,*"
            on:tap={() => (tile.opensWhen ? dispatch('when') : tile.lens && showLens(tile.lens))}
            on:longPress={(event) => event.object instanceof View && showToolTip(tile.label, event.object)}>
            <!-- the value and the line under it, centred together -->
            <canvaslabel fontSize={14} height={18} row={1}>
                <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} text={hideIcon ? '' : tile.icon} verticalAlignment="middle" />
                <cspan color={colorOnSurface} fontWeight="bold" paddingLeft={hideIcon ? 0 : 17} text={tile.value} verticalAlignment="middle" />
            </canvaslabel>
            <!-- always there, so a cursor showing or leaving does not change what the tile holds -->
            <canvaslabel fontSize={11} height={15} row={2} visibility={second ? 'visible' : 'collapse'}>
                <cspan {color} fontFamily={$fonts.mdi} fontSize={11} text={second?.icon ?? ''} verticalAlignment="middle" />
                <cspan {color} fontWeight={second?.remaining ? 'bold' : 'normal'} paddingLeft={14} text={second?.text ?? ''} verticalAlignment="middle" />
            </canvaslabel>
        </gridlayout>
    {/each}
</gridlayout>
