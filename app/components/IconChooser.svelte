<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, closeModal } from 'svelte-native/dom';
    import { osmIcons } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { actionBarButtonHeight, borderColor, lightBackgroundColor, mdiFontFamily, primaryColor } from '~/variables';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';
    import { debounce } from '@nativescript/core/utils';

    const materialIcons = require('~/material_icons.json');

    let collectionView: NativeViewElementNode<CollectionView>;
    let filter: string = null;
    type Item = { fontFamily: string; icon: string; name: string };
    const items: Array<Item> = Object.keys(materialIcons)
        .map((k) => ({ fontFamily: mdiFontFamily, icon: materialIcons[k], name: k }))
        .concat(Object.keys(osmIcons).map((k) => ({ fontFamily: 'osm', icon: osmIcons[k], name: k })));
    let filteredItems: Array<Item> = null;

    const updateFiltered = debounce((filter)=> {
        if (filter) {
            filteredItems = items.filter((d) => d.name.indexOf(filter) !== -1);
        } else {
            filteredItems = items;
        }
    }, 500);
    $: updateFiltered(filter);
    function blurTextField() {}

    function selectIcon(item: Item) {
        closeModal(item);
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,auto,*">
        <CActionBar canGoBack modalWindow title={lc('icon')} />
        <gridlayout margin={10} borderColor={$borderColor} row={1}>
            <textfield
                variant="outline"
                padding="0 30 0 20"
                hint={lc('search')}
                placeholder={lc('search')}
                returnKeyType="search"
                on:return={blurTextField}
                height={actionBarButtonHeight}
                text={filter}
                on:textChange={(e) => (filter = e['value'])}
                backgroundColor="transparent"
                autocapitalizationType="none"
                verticalTextAlignment="center"
            />

            <IconButton
                gray={true}
                isHidden={!filter || filter.length === 0}
                col={1}
                text="mdi-close"
                on:tap={() => (filter = null)}
                verticalAlignment="middle"
                horizontalAlignment="right"
                size={40}
            />
        </gridlayout>
        <collectionview bind:this={collectionView} row={2} items={filteredItems} rowHeight={50} colWidth={50}>
            <Template let:item>
                <gridlayout margin={2}>
                    <canvaslabel
                        fontSize={item.mdi ? 33 : 27}
                        borderRadius={4}
                        backgroundColor={$lightBackgroundColor}
                        textAlignment="center"
                        rippleColor={primaryColor}
                        fontFamily={item.fontFamily}
                        on:tap={selectIcon(item)}
                    >
                        <cspan text={item.icon} verticalAlignment="middle" />
                    </canvaslabel>
                </gridlayout>
            </Template>
        </collectionview>
    </gridlayout>
</page>
