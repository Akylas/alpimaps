<script lang="ts" context="module">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, closeModal } from 'svelte-native/dom';
    import { osmIcons } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { actionBarButtonHeight, borderColor, lightBackgroundColor, mdiFontFamily, primaryColor, textColor } from '~/variables';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';
    import { debounce } from '@nativescript/core/utils';
    import { Utils } from '@nativescript/core';
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { onDestroy, onMount } from 'svelte';
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { widgetBackgroundColor } from '~/variables';
    import { TextField } from '@nativescript-community/ui-material-textfield';

    const materialIcons = require('~/material_icons.json');
    type Item = { fontFamily: string; icon: string; name: string };

    const iconPaint = new Paint();
    iconPaint.setTextAlign(Align.CENTER);

    const ICON_SIZE = 50;
    const items: Array<Item> = Object.keys(osmIcons)
        .map((k) => ({ fontFamily: 'osm', icon: osmIcons[k], name: k }))
        .concat(Object.keys(materialIcons).map((k) => ({ fontFamily: mdiFontFamily, icon: materialIcons[k], name: k })))
        .sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
        console.log('items', items.length)
</script>

<script lang="ts">
    export let elevation = 0;
    export let margin = 0;
    let collectionView: NativeViewElementNode<CollectionView>;
    let textfield: NativeViewElementNode<TextField>;
    let filter: string = null;

    let filteredItems: Array<Item> = null;
    const updateFiltered = debounce((filter) => {
        if (filter) {
            filteredItems = items.filter((d) => d.name.indexOf(filter) !== -1);
        } else {
            filteredItems = items;
        }
    }, 500);
    $: updateFiltered(filter);
    function blurTextField(event?) {
        Utils.dismissSoftInput(event?.object.nativeViewProtected || textfield?.nativeView?.nativeViewProtected);
    }

    function selectIcon(item: Item) {
        closePopover(item);
    }
    onMount(() => {
        iconPaint.color = $textColor;
    });

    function onDraw(item, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();
            iconPaint.fontFamily = item.fontFamily;
            if (item.mdi) {
                iconPaint.textSize = 33;
                canvas.drawText(item.icon, w / 2, h / 2 + 14, iconPaint);
            } else {
                iconPaint.textSize = 22;
                canvas.drawText(item.icon, w / 2, h / 2 + 10, iconPaint);
            }
        } catch (err) {
            console.error(err);
        }
    }

</script>

<!-- <page actionBarHidden={true}> -->
<gesturerootview>
    <gridlayout rows="auto,auto,250" backgroundColor={$widgetBackgroundColor} borderRadius={8} {elevation} {margin}>
        <!-- <CActionBar canGoBack modalWindow title={lc('icon')} /> -->
        <gridlayout margin={10} row={1}>
            <textfield
                bind:this={textfield}
                floating="false"
                padding="3 10 3 10"
                hint={lc('search')}
                placeholder={lc('search')}
                returnKeyType="search"
                height={actionBarButtonHeight}
                text={filter}
                autocapitalizationType="none"
                on:unloaded={blurTextField}
                on:returnPress={blurTextField}
                on:textChange={(e) => (filter = e['value'])}
            />
            <IconButton gray={true} isVisible={filter && filter.length > 0} col={1} text="mdi-close" on:tap={() => (filter = null)} verticalAlignment="middle" horizontalAlignment="right" size={40} />
        </gridlayout>
        <collectionview bind:this={collectionView} itemIdGenerator={(item, i) => i} row={2} items={filteredItems} rowHeight={ICON_SIZE} colWidth={ICON_SIZE}>
            <Template let:item>
                <gridlayout padding={2}>
                    <canvas on:draw={(e) => onDraw(item, e)} backgroundColor={$lightBackgroundColor} borderRadius={4} rippleColor={primaryColor} on:tap={selectIcon(item)} />
                </gridlayout>
            </Template>
        </collectionview>
    </gridlayout>
</gesturerootview>
<!-- </page> -->
