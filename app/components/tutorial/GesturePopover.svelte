<script lang="ts">
    import PanelPopover from '~/components/common/PanelPopover.svelte';
    import type { GestureKind } from '~/components/tutorial/tutorialPages';
    import { lc } from '~/helpers/locale';
    import { colors } from '~/variables';

    export let id: string;
    export let gesture: GestureKind;

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary, colorSurfaceContainer } = $colors);
</script>

<!-- opaque: the panel color is translucent, and the schematic behind it would show through the text -->
<PanelPopover backgroundColor={colorSurfaceContainer}>
    <stacklayout padding="10 0" width={230}>
        <label color={colorPrimary} fontSize={11} text={lc(`gesture_${gesture}`).toUpperCase()} />
        <label color={colorOnSurface} fontSize={16} fontWeight="bold" text={lc(`gesture_${id}_title`)} textWrap={true} />
        <label color={colorOnSurfaceVariant} fontSize={14} text={lc(`gesture_${id}_desc`)} textWrap={true} />
    </stacklayout>
</PanelPopover>
