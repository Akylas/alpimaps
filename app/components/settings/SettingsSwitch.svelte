<svelte:options accessors />

<script context="module" lang="ts">
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
</script>

<script lang="ts">
    export let item;
    export let onCheckBox: (item, value, e) => void = null;

    function onCheckChanged(e) {
        item.value = e.value;
        onCheckBox?.(item, e.value, e);
    }
</script>

<ListItemAutoSize fontSize={16} {item} leftIcon={item.icon} {...$$restProps}>
    <switch id="checkbox" checked={item.value} col={1} marginLeft={10} verticalAlignment="center" on:checkedChange={onCheckChanged} />
</ListItemAutoSize>
