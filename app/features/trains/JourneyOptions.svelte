<script lang="ts">
    import { pickDateTime } from '@nativescript-community/ui-datetimepicker';
    import { showError } from '@shared/utils/showError';
    import dayjs from 'dayjs';
    import { lc } from '~/helpers/locale';
    import { journeyArriveBy, journeyTime } from '~/features/trains/itinerary';
    import Pill from '~/components/common/Pill.svelte';

    async function pickDepartureTime() {
        try {
            const picked = await pickDateTime({ date: $journeyTime ?? new Date(), title: lc($journeyArriveBy ? 'arrive_by' : 'depart_at'), is24Hour: true });
            if (picked) {
                $journeyTime = picked;
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<Pill icon="mdi-clock-outline" label={$journeyTime ? dayjs($journeyTime).format('ddd D MMM HH:mm') : lc('now')} on:tap={pickDepartureTime} on:longPress={() => ($journeyTime = null)} />
<Pill icon={$journeyArriveBy ? 'mdi-clock-end' : 'mdi-clock-start'} label={lc($journeyArriveBy ? 'arrive_by' : 'depart_at')} on:tap={() => ($journeyArriveBy = !$journeyArriveBy)} />
