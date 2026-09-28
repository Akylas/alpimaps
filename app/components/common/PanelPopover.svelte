<script lang="ts">
    // the shared popover container with the peak finder panel look, so tools/ stays untouched
    import PopoverBackgroundView from '@shared/components/PopoverBackgroundView.svelte';
    import { colors } from '~/variables';

    let { colorHairline, colorPanel } = $colors;
    $: ({ colorHairline, colorPanel } = $colors);
</script>

<PopoverBackgroundView backgroundColor={colorPanel} borderColor={colorHairline} borderRadius={20} borderWidth={1} {...$$restProps}>
    <slot />
</PopoverBackgroundView>
