<script lang="ts">
    // a row of the Sun card of the route page: the bar of what the route is made of by class of the sun, when the ride starts and ends,
    // the sunset and the dusk against the ride, the dark and the glare, where the sun is against the way, the note on what is left out
    import { formatDistance, formatDuration } from '~/helpers/formatter';
    import { formatTime, lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import type { IItem } from '~/models/Item';
    import { currentLensPalette } from '~/routeFeatures/lens/lensStyle';
    import { SUN_PALETTE_KEYS, type SunClass } from '~/routeFeatures/sun/read';
    import type { SunRowData } from '~/routeFeatures/sun/rows';
    import type { SunSide } from '~/utils/astronomy/sun';
    import { colors, fonts } from '~/variables';

    // the page hands every row its item; the rows of this card say it all
    export let item: IItem;
    export let data: SunRowData;
    // the page gives every row its item, this card's rows have no use for it
    // eslint-disable-next-line no-unused-expressions
    $: item;

    let { colorError, colorOnSurface, colorOnSurfaceVariant } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant } = $colors);

    const EVENT_ICONS = { sunset: 'mdi-weather-sunset-down', dusk: 'mdi-weather-sunset', moonrise: 'mdi-moon-waxing-crescent', moonset: 'mdi-moon-waning-crescent' };
    const SIDES: SunSide[] = ['left', 'ahead', 'right', 'behind'];
    const palette = currentLensPalette(isEInk ? 'eink' : 'light');
    const swatch = (sunClass: SunClass) => palette[SUN_PALETTE_KEYS[sunClass]];
    const time = (at: number, offset?: number) => formatTime(at, 'LT', offset);

    function eventSub(row: Extract<SunRowData, { type: 'event' }>) {
        switch (row.relation) {
            case 'during':
                return lc('sun_event_during', formatDistance(row.distance));
            case 'before':
                return lc('sun_event_before', formatDuration(row.ms / 1000));
            default:
                return lc('sun_event_after', formatDuration(row.ms / 1000));
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
{:else if data.type === 'times'}
    <gridlayout columns="32,*,*" height={48} padding="0 16">
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text="mdi-clock-outline" verticalAlignment="middle" />
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={time(data.start, data.offset)} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={lc('sun_leave')} />
        </stacklayout>
        <stacklayout col={2} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={time(data.end, data.offset)} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={lc('sun_arrive')} />
        </stacklayout>
    </gridlayout>
{:else if data.type === 'event'}
    <gridlayout columns="32,*" height={48} padding="0 16">
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={EVENT_ICONS[data.id]} verticalAlignment="middle" />
        <stacklayout col={1} verticalAlignment="middle">
            <label color={colorOnSurface} fontSize={14} fontWeight="bold" text={lc(`sun_event_${data.id}`, time(data.at, data.offset))} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={eventSub(data)} />
        </stacklayout>
    </gridlayout>
{:else if data.type === 'dark'}
    <gridlayout columns="32,*" height={40} padding="0 16">
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text="mdi-weather-night" verticalAlignment="middle" />
        <label col={1} color={colorOnSurface} fontSize={14} text={lc('sun_dark_for', formatDuration(data.ms / 1000))} verticalAlignment="middle" />
    </gridlayout>
{:else if data.type === 'glare'}
    <gridlayout columns="32,*" height={40} padding="0 16">
        <label color={isEInk ? colorOnSurface : colorError} fontFamily={$fonts.mdi} fontSize={20} text="mdi-white-balance-sunny" verticalAlignment="middle" />
        <label col={1} color={colorOnSurface} fontSize={14} text={lc('sun_glare_for', formatDistance(data.meters))} verticalAlignment="middle" />
    </gridlayout>
{:else if data.type === 'side'}
    <gridlayout columns="32,*" padding="8 16">
        <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} text={data.body === 'moon' ? 'mdi-moon-waning-crescent' : 'mdi-compass-outline'} verticalAlignment="top" />
        <stacklayout col={1}>
            <label color={colorOnSurface} fontSize={14} text={lc(data.body === 'moon' ? 'sun_moon_side_title' : 'sun_side_title')} />
            <label color={colorOnSurfaceVariant} fontSize={12} text={sideText} textWrap={true} />
        </stacklayout>
    </gridlayout>
{:else}
    <label color={colorOnSurfaceVariant} fontSize={12} padding="8 16 12 16" text={lc('sun_note')} textWrap={true} />
{/if}
