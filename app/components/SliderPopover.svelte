<script context="module" lang="ts">
    import { widgetBackgroundColor } from '~/variables';
    import SettingsSlider from './SettingsSlider.svelte';
</script>

<script lang="ts">
    export let icon: string = null;
    export let title: string = null;
    export let min = 0;
    export let max = 1;
    export let step = 0.01;
    export let value = 0;
    export let backgroundColor = $widgetBackgroundColor;
    export let onChange = null;
    export let formatter = (value) => value + '';
    export let valueFormatter = (value) => value.toFixed(1);
</script>

<gridlayout>
    <SettingsSlider {backgroundColor} borderRadius={4} elevation={2} {formatter} {icon} margin={2} {max} {min} {onChange} {step} {title} {value} {valueFormatter} />
</gridlayout>
