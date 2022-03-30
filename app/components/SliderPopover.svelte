<script lang="ts" context="module">
    import UserLocationModule from '~/mapModules/UserLocationModule';
    import { widgetBackgroundColor } from '~/variables';
</script>

<script lang="ts">
    export let icon: string = null;
    export let title: string = null;
    export let min = 0;
    export let max = 1;
    export let value = 0;
    export let onChange = null;

    function onValueChange(event) {
        if (onChange) {
            onChange(event.value);
        }
    }
</script>

<gridLayout>
<gridLayout rows="auto,auto" columns="auto,*,auto" padding="10" borderRadius="4" backgroundColor={$widgetBackgroundColor} margin="2" elevation="2">
    <label class="icon-label" text={icon} />
    <label text={title} col={1} verticalTextAlignment="center" />
    <label text={min + ''} row={1} verticalTextAlignment="center" textAlignment="center"/>
    <label text={max + ''} row={1} col={2} verticalTextAlignment="center" textAlignment="center"/>
    <slider row={1} col={1} {value} on:valueChange={onValueChange} minValue={min} maxValue={max} />
</gridLayout>
</gridLayout>
