<svelte:options accessors />

<script context="module" lang="ts">
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
</script>

<script lang="ts">
    export let item;
    export let checkboxProps = null;
    export let onCheckBox: (item, value, e) => void = null;

    function onCheckChanged(e) {
        item.value = e.value;
        onCheckBox?.(item, e.value, e);
    }
</script>

<ListItemAutoSize columns={item.icon ? 'auto,*,auto' : '*,auto'} fontSize={16} icon={item.icon} {item} mainCol={item.icon ? 1 : 0} {...$$restProps}>
    <switch id="checkbox" checked={item.value} col={item.icon ? 2 : 1} marginLeft={10} verticalAlignment="center" {...checkboxProps ?? {}} on:checkedChange={onCheckChanged} />
    <slot />
</ListItemAutoSize>
