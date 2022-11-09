<script lang="ts" context="module">
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
</script>

<gridLayout>
    <SettingsSlider borderRadius="4" {backgroundColor} margin="2" elevation="2" {icon} {title} {value} {min} {max} {step} {onChange} {formatter} />
</gridLayout>
