<script context="module" lang="ts">
    import { colors } from '~/variables';
    import SettingsSlider from '../settings/SettingsSlider.svelte';
    import PopoverBackgroundView from './PopoverBackgroundView.svelte';
</script>

<script lang="ts">
    $: ({ colorSurfaceContainer } = $colors);
    export let icon: string = null;
    export let title: string = null;
    export let min = 0;
    export let max = 1;
    export let step = 0.01;
    export let value = 0;
    export let onChange = null;
    export let formatter = (value) => value + '';
    export let valueFormatter = (value) => value.toFixed(1);
</script>

<PopoverBackgroundView rows="auto">
    <SettingsSlider {formatter} {icon} {max} {min} {onChange} {step} {title} {value} {valueFormatter} />
</PopoverBackgroundView>
