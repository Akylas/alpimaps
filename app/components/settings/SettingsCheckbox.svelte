<svelte:options accessors />

<script context="module" lang="ts">
    import { colors } from '~/variables';
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
    import { conditionalEvent } from '@shared/utils/svelte/ui';
</script>

<script lang="ts">
    export let item;
    export let checkboxProps = null;
    export let onCheckBox: (item, value) => void = null;
    export let onCheckBoxTap: (item, value) => void = null;

    function onCheckChanged(e) {
        item.value = e.value;
        onCheckBox?.(item, e.value);
    }
    function onCheckTap(e) {
        onCheckBoxTap?.(item, e);
    }
    </script>

<ListItemAutoSize fontSize={16} {item} leftIcon={item.icon}  {...$$restProps} on:tap>
    <checkbox id="checkbox" checked={item.value} {...(checkboxProps??{})} on:checkedChange={onCheckChanged} use:conditionalEvent={{ condition: onCheckBoxTap, event: 'tap', callback: onCheckTap }} />
</ListItemAutoSize>