<script lang="ts">
    import dayjs from 'dayjs';
    import type SimpleOpeningHours from '~/helpers/SimpleOpeningHours';
    import { formatTime, lc } from '~/helpers/locale';
    import { colors } from '~/variables';

    export let openingHours: SimpleOpeningHours;

    $: ({ colorOnSurface } = $colors);

    const days = [
        { key: 'su', name: 'sunday' },
        { key: 'mo', name: 'monday' },
        { key: 'tu', name: 'tuesday' },
        { key: 'we', name: 'wednesday' },
        { key: 'th', name: 'thursday' },
        { key: 'fr', name: 'friday' },
        { key: 'sa', name: 'saturday' }
    ];
    const today = dayjs().day();

    function formatRanges(ranges: string[]) {
        if (!ranges?.length) {
            return lc('closed');
        }
        const date = dayjs();
        return ranges
            .map((range) =>
                range
                    .split('-')
                    .map((time) => {
                        const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
                        return formatTime(date.set('h', hours).set('m', minutes), 'LT');
                    })
                    .join(' - ')
            )
            .join(',');
    }

    $: data = openingHours?.openingHours;
</script>

{#if typeof data === 'object'}
    <stacklayout padding="0 16 12 16" {...$$restProps}>
        {#each days as day, index}
            <gridlayout columns="*,auto" padding="3 0" rows="auto">
                <label color={colorOnSurface} fontSize={14} fontWeight={index === today ? 'bold' : 'normal'} text={day.name} />
                <label col={1} color={colorOnSurface} fontSize={14} fontWeight={index === today ? 'bold' : 'normal'} text={formatRanges(data[day.key])} />
            </gridlayout>
        {/each}
    </stacklayout>
{/if}
