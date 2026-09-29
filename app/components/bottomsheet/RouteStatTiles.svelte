<script lang="ts">
    // the route's totals as labelled tiles, rather than an icon strip under the title
    import { convertDurationSeconds, convertElevation, formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem as Item } from '~/models/Item';
    import { colors } from '~/variables';

    export let item: Item;

    let { colorHairline, colorOnSurface, colorOnSurfaceVariant, colorSurfaceFill } = $colors;
    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorSurfaceFill } = $colors);

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
            distance > 0 && { label: lc('distance'), value: formatDistance(distance) },
            route.totalTime > 0 && { label: lc('duration'), value: convertDurationSeconds(route.totalTime) },
            ascent > 0 && { label: lc('ascent'), value: convertElevation(ascent) },
            descent > 0 && { label: lc('descent'), value: convertElevation(descent) }
        ].filter(Boolean);
    }
    $: tiles = tilesFor(item);
</script>

<gridlayout columns={tiles.map(() => '*').join(',') || '*'} padding="0 12 0 12" {...$$restProps}>
    {#each tiles as tile, index}
        <stacklayout backgroundColor={colorSurfaceFill} borderColor={colorHairline} borderRadius={12} borderWidth={isEInk ? 1 : 0} col={index} margin="0 3" padding="6 10">
            <label color={colorOnSurfaceVariant} fontSize={12} maxLines={1} text={tile.label} />
            <label color={colorOnSurface} fontSize={16} fontWeight="bold" maxLines={1} text={tile.value} />
        </stacklayout>
    {/each}
</gridlayout>
