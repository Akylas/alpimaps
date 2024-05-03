<script context="module" lang="ts">
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { Template } from 'svelte-native/components';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { IItem } from '~/models/Item';
    import { colors } from '~/variables';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
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
    <collectionView id="scrollView" height={200} items={options} rowHeight={72} ios:contentInsetAdjustmentBehavior={2}>
        <Template let:item>
            <ListItemAutoSize
                borderRadius={30}
                extraPaddingLeft={44}
                fontSize={15}
                showSymbol
                subtitle={itemSubtitle(item)}
                symbol={formatter.getSymbol(item.route.properties)}
                symbolColor={item.route.properties?.color || colorOnSurface}
                title={itemTitle(item)}
                on:tap={(event) => onTap(item, event)} />
        </Template>
    </collectionView>
</gesturerootview>
