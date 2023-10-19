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
    import { IItem } from '~/models/Item';

    type RouteItem ={name:string, route:IItem }

    export let options: RouteItem[];

    function close(value?: RouteItem) {
        closeBottomSheet(value);
    }

    function onTap(item: RouteItem, args) {
        close(item);
    }
    function itemTitle(item: RouteItem) {
        return item.name || item.route.properties.class;
    }
    function itemSubtitle(item: RouteItem) {
        const title = itemTitle(item);
        const subtitle =item.route.properties.subtitle || item.route.properties.ref;
        return subtitle !== title ? subtitle : undefined
    }
</script>

<collectionView items={options} rowHeight={72} height={200}>
    <Template let:item>
        <ListItem
            title={itemTitle(item)}
            subtitle={itemSubtitle(item)}
            showBottomLine
            extraPaddingLeft={44}
            on:tap={(event) => onTap(item, event)}
            showSymbol
            symbol={formatter.getSymbol(item.route.properties)}
            symbolColor={item.route.properties?.color || $textColor}
        />
    </Template>
</collectionView>
