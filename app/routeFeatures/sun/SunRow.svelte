<script lang="ts">
    // a row of the Sun card of the route page: the bar of what the route is made of by class of the sun, the figures of the ride as chips in
    // their colours (the sun and the moon's events, the dark, the moonlight, the glare), where the sun is against the way, the note on what is
    // left out. The shade is in the bar's legend. A tap on a chip says what it is and where it falls
    import { showError } from '@shared/utils/showError';
    import Chip from '~/components/common/Chip.svelte';
    import { formatDistance, formatDuration } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { explainChip } from '~/routeFeatures/sun/explain';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { currentLensPalette } from '~/routeFeatures/lens/lensStyle';
    import type { LensFact } from '~/routeFeatures/registry';
    import { SUN_COLORS } from '~/routeFeatures/sun/colors';
    import { SUN_PALETTE_KEYS, type SunClass } from '~/routeFeatures/sun/read';
    import { startRouteSunMode } from '~/routeFeatures/sun/sunMode';
    import { showSnack } from '~/utils/ui';
    import type { SunRowData } from '~/routeFeatures/sun/rows';
    import type { SunSide } from '~/utils/astronomy/sun';
    import { colors, fonts } from '~/variables';

    export let item: IItem;
    export let data: SunRowData;

    let { colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    const EVENT_CHIPS = {
        sunrise: { icon: 'mdi-weather-sunset-up', color: SUN_COLORS.sunrise },
        sunset: { icon: 'mdi-weather-sunset-down', color: SUN_COLORS.sunset },
        dusk: { icon: 'mdi-weather-sunset', color: SUN_COLORS.dusk },
        moonrise: { icon: 'mdi-moon-waxing-crescent', color: SUN_COLORS.moon },
        moonset: { icon: 'mdi-moon-waning-crescent', color: SUN_COLORS.moon }
    };
    const SIDES: SunSide[] = ['left', 'ahead', 'right', 'behind'];
    const palette = currentLensPalette(isEInk ? 'eink' : 'light');
    const swatch = (sunClass: SunClass) => palette[SUN_PALETTE_KEYS[sunClass]];

    // the icon says what it is, the time or the length is all the chip says; a tap says the rest (`help`)
    $: chips = data.type === 'chips' ? chipsOf(data) : [];
    type SunChip = LensFact & { key: string; help: string };
    function whereOf(event: Extract<SunRowData, { type: 'chips' }>['events'][number]) {
        return event.relation === 'during' ? formatDistance(event.distance) : formatDuration(event.ms / 1000);
    }
    function chipsOf(row: Extract<SunRowData, { type: 'chips' }>): SunChip[] {
        const result: SunChip[] = row.events.map((event) => {
            const time = formatTime(event.at, 'LT', event.offset);
            return { key: event.id, ...EVENT_CHIPS[event.id], text: time, help: explainChip({ kind: event.id, time, relation: event.relation, where: whereOf(event) }, lc) };
        });
        if (row.darkMs > 0) {
            const length = formatDuration(row.darkMs / 1000);
            result.push({ key: 'dark', icon: 'mdi-weather-night', text: length, color: SUN_COLORS.dark, help: explainChip({ kind: 'dark', length }, lc) });
        }
        if (row.moonlitMs > 0) {
            const length = formatDuration(row.moonlitMs / 1000);
            result.push({ key: 'moonlit', icon: 'mdi-moon-waning-crescent', text: length, color: SUN_COLORS.moon, help: explainChip({ kind: 'moonlit', length }, lc) });
        }
        if (row.glareMeters > 0) {
            const length = formatDistance(row.glareMeters);
            result.push({ key: 'glare', icon: 'mdi-white-balance-sunny', text: length, alert: true, help: explainChip({ kind: 'glare', length }, lc) });
        }
        return result;
    }

    async function preview() {
        try {
            await startRouteSunMode(item);
        } catch (error) {
            showError(error);
        }
    }

    $: sideText =
        data.type === 'side'
            ? SIDES.filter((side) => data[side] >= 0.05)
                  .map((side) => `${lc(`sun_side_${side}`)} ${Math.round(data[side] * 100)} %`)
                  .join(' · ')
            : '';
</script>

{#if data.type === 'bar'}
    <stacklayout padding="8 16">
        <gridlayout borderRadius={5} columns={data.shares.map((share) => share.meters + '*').join(',') || '*'} height={10}>
            {#each data.shares as share, index}
                <absolutelayout backgroundColor={swatch(share.k)} col={index} />
            {/each}
        </gridlayout>
        {#each data.shares as share}
            <gridlayout columns="22,*,auto" height={26}>
                <label color={swatch(share.k)} fontFamily={$fonts.mdi} fontSize={14} text="mdi-square-rounded" verticalAlignment="middle" />
                <label col={1} color={colorOnSurface} fontSize={13} text={lc(`legend_sun_${share.k}`)} verticalAlignment="middle" />
                <label col={2} color={colorOnSurfaceVariant} fontSize={13} text={formatDistance(share.meters)} verticalAlignment="middle" />
            </gridlayout>
        {/each}
    </stacklayout>
{:else if data.type === 'chips'}
    <wraplayout padding="6 12 2 12">
        {#each chips as chip (chip.key)}
            <Chip alert={chip.alert ?? false} color={chip.color} height={24} icon={chip.icon} text={chip.text} on:tap={() => showSnack({ message: chip.help })} />
        {/each}
    </wraplayout>
{:else if data.type === 'side'}
    <gridlayout columns="32,*" height={30} padding="0 16">
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={18} text={data.body === 'moon' ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny'} verticalAlignment="middle" />
        <label col={1} color={colorOnSurface} fontSize={13} maxLines={1} text={sideText} verticalAlignment="middle" />
    </gridlayout>
{:else if data.type === 'preview'}
    <gridlayout columns="32,*" height={48} padding="0 16" rippleColor={colorPrimary} on:tap={preview}>
        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={20} text="mdi-video-3d" verticalAlignment="middle" />
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={lc('sun_mode_preview')} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={lc('sun_mode_preview_desc')} />
        </stacklayout>
    </gridlayout>
{:else}
    <label color={colorOnSurfaceVariant} fontSize={12} padding="8 16 12 16" text={lc(data.terrain ? 'sun_note_terrain' : 'sun_note')} textWrap={true} />
{/if}
