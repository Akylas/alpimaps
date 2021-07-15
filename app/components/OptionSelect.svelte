<script lang="ts" context="module">
    export interface OptionType {
        name: string;
        data?: string;
    }
</script>

<script lang="ts">
    import { Template } from 'svelte-native/components';
    import ListItem from './ListItem.svelte';
    import { closeModal } from 'svelte-native';
    import { closeBottomSheet } from './bottomsheet';

    export let options: OptionType[];

    export let height: number = 350;

    function close(value?: OptionType) {
        closeBottomSheet(value);
    }

    function onTap(item: OptionType, args) {
        close(item);
    }
</script>

<collectionView row="1" items={options} {height} rowHeight="72">
    <Template let:item>
        <ListItem title={item.name} on:tap={(event) => onTap(item, event)} />
    </Template>
</collectionView>
