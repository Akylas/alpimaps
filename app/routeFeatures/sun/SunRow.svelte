<script lang="ts">
    // a row of the Sun card of the route page: the bar of what the route is made of by class of the sun, the figures of the ride as chips in
    // their colours (the sun and the moon's events, the dark, the moonlight, the glare), where the sun is against the way, the note on what is
    // left out. The shade is in the bar's legend. A tap on a chip says what it is and where it falls
    import { showError } from '@shared/utils/showError';
    import Chip from '~/components/common/Chip.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { barGradient } from '~/routeFeatures/lens/barGradient';
    import { currentLensPalette } from '~/routeFeatures/lens/lensStyle';
    import { type SunChip, eventChip, figureChip } from '~/routeFeatures/sun/chips';
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

    const SIDES: SunSide[] = ['left', 'ahead', 'right', 'behind'];
    const palette = currentLensPalette(isEInk ? 'eink' : 'light');
    const swatch = (sunClass: SunClass) => palette[SUN_PALETTE_KEYS[sunClass]];

    $: chips = data.type === 'chips' ? chipsOf(data) : [];
    function chipsOf(row: Extract<SunRowData, { type: 'chips' }>): SunChip[] {
        const result = row.events.map((event) => eventChip(event, (at) => formatTime(at, 'LT', event.offset)));
        if (row.darkMs > 0) {
            result.push(figureChip('dark', row.darkMs));
        }
        if (row.moonlitMs > 0) {
            result.push(figureChip('moonlit', row.moonlitMs));
        }
        if (row.glareMeters > 0) {
            result.push(figureChip('glare', row.glareMeters));
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
    <gridlayout columns="*,auto" padding="8 16" rows={['10', ...data.shares.map(() => '26')].join(',')}>
        <gridlayout backgroundImage={barGradient(data.shares.map((share) => ({ color: swatch(share.k), size: share.meters })))} borderRadius={5} colSpan={2} />
        {#each data.shares as share, index}
            <label color={colorOnSurface} fontSize={13} row={index + 1} verticalTextAlignment="middle">
                <cspan color={swatch(share.k)} fontFamily={$fonts.mdi} fontSize={14} text="mdi-square-rounded" />
                <cspan text={'\u2002' + lc(`legend_sun_${share.k}`)} />
            </label>
            <label col={1} color={colorOnSurfaceVariant} fontSize={13} row={index + 1} text={formatDistance(share.meters)} verticalTextAlignment="middle" />
        {/each}
    </gridlayout>
{:else if data.type === 'chips'}
    <wraplayout padding="6 12 2 12">
        {#each chips as chip (chip.key)}
            <Chip alert={chip.alert ?? false} color={chip.color} height={24} icon={chip.icon} text={chip.text} on:tap={() => showSnack({ message: chip.help })} />
        {/each}
    </wraplayout>
{:else if data.type === 'side'}
    <label color={colorOnSurface} fontSize={13} height={30} maxLines={1} padding="0 16" verticalTextAlignment="middle">
        <cspan color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={18} text={data.body === 'moon' ? 'mdi-moon-waning-crescent' : 'mdi-white-balance-sunny'} />
        <cspan text={'\u2003' + sideText} />
    </label>
{:else if data.type === 'preview'}
    <gridlayout columns="32,*" height={48} padding="0 16" rippleColor={colorPrimary} on:tap={preview}>
        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={20} text="mdi-video-3d" verticalAlignment="middle" />
        <label col={1} verticalAlignment="middle">
            <cspan color={colorOnSurface} fontSize={14} fontWeight="bold" text={lc('sun_mode_preview')} />
            <cspan color={colorOnSurfaceVariant} fontSize={12} text={'\n' + lc('sun_mode_preview_desc')} />
        </label>
    </gridlayout>
{:else}
    <label color={colorOnSurfaceVariant} fontSize={12} padding="8 16 12 16" text={lc(data.terrain ? 'sun_note_terrain' : 'sun_note')} textWrap={true} />
{/if}
