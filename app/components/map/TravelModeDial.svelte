<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import PanelPopover from '~/components/common/PanelPopover.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import type { TravelMode } from '~/routeFeatures/junctions/travelMode';
    import { showTurnOptions, travelMode } from '~/stores/travelModeStore';
    import { Profiles } from '~/utils/routing';
    import { fonts } from '~/variables';

    const options: { mode: TravelMode; label: string; icon: string; fontFamily?: string }[] = [
        { mode: 'walk', label: lc('walk'), ...Profiles.pedestrian },
        { mode: 'bike', label: lc('bicycle'), ...Profiles.bicycle },
        { mode: 'car', label: lc('car'), ...Profiles.auto },
        { mode: 'auto', label: lc('travel_mode_auto'), icon: 'mdi-routes' }
    ];

    function select(mode: TravelMode) {
        $travelMode = mode;
        closePopover();
    }
</script>

<PanelPopover>
    <stacklayout padding="8 0 4 0">
        {#each options as option (option.mode)}
            <Pill
                icon={option.icon}
                iconFontFamily={option.fontFamily ? $fonts[option.fontFamily] : null}
                label={option.label}
                margin="2 8 2 8"
                selected={$travelMode === option.mode}
                on:tap={() => select(option.mode)} />
        {/each}
        <StoreSwitch store={showTurnOptions} title={lc('show_turn_options')} />
    </stacklayout>
</PanelPopover>
