<svelte:options accessors />

<script context="module" lang="ts">
    import { colors } from '~/variables';
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
</script>

<script lang="ts">
    $: ({ colorOutlineVariant } = $colors);

    export let item;
    export let onCheckBox: (item, value) => void = null;

    $: DEV_LOG && console.log('SettingsSwitch', JSON.stringify(item));

    function onCheckChanged(e) {
        item.value = e.value;
        onCheckBox?.(item, e.value);
    }
</script>

<ListItemAutoSize fontSize={16} {item} leftIcon={item.icon} {...$$restProps}>
    <switch id="checkbox" checked={item.value} col={1} marginLeft={10} verticalAlignment="center" on:checkedChange={onCheckChanged} />
</ListItemAutoSize>
