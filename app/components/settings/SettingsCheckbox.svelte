<svelte:options accessors />

<script context="module" lang="ts">
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
    import { conditionalEvent } from '@shared/utils/svelte/ui';
</script>

<script lang="ts">
    export let item;
    export let checkboxProps = null;
    export let onCheckBox: (item, value, event) => void = null;
    export let onCheckBoxTap: (item, event) => void = null;

    function onCheckChanged(e) {
        item.value = e.value;
        onCheckBox?.(item, e.value, e);
    }
    function onCheckTap(e) {
        onCheckBoxTap?.(item, e);
    }
</script>

<ListItemAutoSize fontSize={16} {item} leftIcon={item.icon} {...$$restProps} on:tap>
    <checkbox id="checkbox" checked={item.value} {...checkboxProps ?? {}} on:checkedChange={onCheckChanged} use:conditionalEvent={{ condition: onCheckBoxTap, event: 'tap', callback: onCheckTap }} />
</ListItemAutoSize>
