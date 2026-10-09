<script lang="ts">
    import SharedListItem from '@shared/components/ListItem.svelte';
    import { fontScaleMaxed } from '~/variables';
    import { ListItem } from './ListItem';

    export let item: ListItem;
    export let onLongPress: (item, e) => void = null;
</script>

<!-- the app's design: the capped font scale, and a long press that hands over the item -->
<SharedListItem fontScaleOverride={$fontScaleMaxed} {item} longPressWithItem={true} {onLongPress} {...$$restProps} on:tap>
    <slot />
</SharedListItem>
