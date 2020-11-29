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

    export let options: OptionType[];

    export let height: number = 350;

    function close(value?: OptionType) {
        closeModal(value);
    }

    function onTap(item: OptionType, args) {
        close(item);
    }
</script>

<collectionView row="1" items={options} {height}>
    <Template let:item>
        <ListItem title={item.name} subtitle={item.data} showBottomLine on:tap={(event) => onTap(item, event)} />
    </Template>
</collectionView>
