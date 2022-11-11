<script lang="ts" context="module">
    export interface OptionType {
        name: string;
        data?: string;
    }
</script>

<script lang="ts">
    import { Template } from 'svelte-native/components';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { closeBottomSheet } from '~/utils/svelte/bottomsheet';
    import ListItem from './ListItem.svelte';
    import { textColor } from '~/variables';

    export let options: OptionType[];

    function close(value?: OptionType) {
        closeBottomSheet(value);
    }

    function onTap(item: OptionType, args) {
        close(item);
    }
    
</script>

<collectionView items={options} rowHeight={72} height={200}>
    <Template let:item>
        <ListItem
            title={item.name || item.route.featureData.class}
            subtitle={item.route.featureData.ref}
            showBottomLine
            extraPaddingLeft={44}
            on:tap={(event) => onTap(item, event)}
            showSymbol
            symbol={formatter.getSymbol(item.route.featureData)}
            symbolColor={item.route.featureData?.color || $textColor}
        />
    </Template>
</collectionView>
