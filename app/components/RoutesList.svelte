<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { ObservableArray } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { lc, onLanguageChanged } from '~/helpers/locale';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { subtitleColor } from '~/variables';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';
    import CActionBar from './CActionBar.svelte';

    let collectionView: NativeViewElementNode<CollectionView>;

    let items: ObservableArray<any>;
    const itemsModule = getMapContext().mapModule('items');
    onServiceLoaded(refresh);

    async function refresh() {
        const sqlItems = await itemsModule.itemRepository.searchItem(SqlQuery.createFromTemplateString`"route" IS NOT NULL`);
        items = new ObservableArray(sqlItems);
    }

    onLanguageChanged(refresh);
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <CActionBar canGoBack title={lc('routes')} />
        <collectionview bind:this={collectionView} row={1} {items} rowHeight="80">
            <Template let:item>
                <gridlayout columns="auto, *" padding="0 10 0 10">
                    <image src={item.image_path} borderRadius={8} width={70} height={70} />
                    <BottomSheetInfoView col={1} {item} />
                </gridlayout>
            </Template>
        </collectionview>
        <label row={1} text={lc('no_route')} color={$subtitleColor} visibility={items && items.length ? 'hidden' : 'visible'} textAlignment="center" verticalAlignment="middle" />
    </gridlayout>
</page>
