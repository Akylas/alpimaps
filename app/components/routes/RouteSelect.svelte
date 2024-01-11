<script context="module" lang="ts">
    import { Template } from 'svelte-native/components';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { IItem } from '~/models/Item';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { colors, fonts } from '~/variables';
    import ListItem from '../common/ListItem.svelte';
    export interface OptionType {
        name: string;
        data?: string;
    }
</script>

<script lang="ts">
    $: ({ colorOnSurface } = $colors);

    interface RouteItem {
        name: string;
        route: IItem;
    }

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
        const subtitle = item.route.properties.subtitle || item.route.properties.ref;
        return subtitle !== title ? subtitle : undefined;
    }
</script>

<gesturerootview rows="auto">
    <collectionView height={200} items={options} rowHeight={72}>
        <Template let:item>
            <ListItem
                borderRadius={30}
                extraPaddingLeft={44}
                showSymbol
                subtitle={itemSubtitle(item)}
                symbol={formatter.getSymbol(item.route.properties)}
                symbolColor={item.route.properties?.color || colorOnSurface}
                title={itemTitle(item)}
                on:tap={(event) => onTap(item, event)} />
        </Template>
    </collectionView>
</gesturerootview>
