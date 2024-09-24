<script context="module" lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { TextField } from '@nativescript-community/ui-material-textfield';
    import { closePopover } from '@nativescript-community/ui-popover/svelte';
    import { Utils } from '@nativescript/core';
    import { debounce } from '@nativescript/core/utils';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { osmIcons } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { actionBarButtonHeight, colors, fonts } from '~/variables';
    import IconButton from '../common/IconButton.svelte';

    const materialIcons = require('~/material_icons.json');
    interface Item {
        fontFamily: string;
        icon: string;
        name: string;
    }

    const iconPaint = new Paint();
    iconPaint.setTextAlign(Align.CENTER);

    const ICON_SIZE = 50;
    let items: Item[];
</script>

<script lang="ts">
    $: ({ colorOnSurface, colorSurfaceContainerHigh, colorSurfaceContainer } = $colors);
    if (!items) {
        items = Object.keys(osmIcons)
            .map((k) => ({ fontFamily: 'osm', icon: osmIcons[k], name: k }))
            .concat(Object.keys(materialIcons).map((k) => ({ fontFamily: $fonts.mdi, icon: materialIcons[k], name: k })))
            .sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));
    }
    export let elevation = 0;
    export let margin = 0;
    let collectionView: NativeViewElementNode<CollectionView>;
    let textfield: NativeViewElementNode<TextField>;
    let filter: string = null;

    let filteredItems: Item[] = null;
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
        iconPaint.color = colorOnSurface;
    });

    function onDraw(item, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
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
    <gridlayout backgroundColor={colorSurfaceContainer} borderRadius={8} {elevation} {margin} rows="auto,auto,250">
        <gridlayout margin={10} row={1}>
            <textfield
                bind:this={textfield}
                autocapitalizationType="none"
                floating={false}
                height={$actionBarButtonHeight}
                hint={lc('search')}
                padding="3 10 3 10"
                placeholder={lc('search')}
                returnKeyType="search"
                text={filter}
                on:unloaded={blurTextField}
                on:returnPress={blurTextField}
                on:textChange={(e) => (filter = e['value'])} />
            <IconButton col={1} gray={true} horizontalAlignment="right" isVisible={filter && filter.length > 0} size={40} text="mdi-close" verticalAlignment="middle" on:tap={() => (filter = null)} />
        </gridlayout>
        <collectionview bind:this={collectionView} colWidth={ICON_SIZE} itemIdGenerator={(item, i) => i} items={filteredItems} row={2} rowHeight={ICON_SIZE}>
            <Template let:item>
                <gridlayout padding={2}>
                    <canvasview backgroundColor={colorSurfaceContainerHigh} borderRadius={4} rippleColor={colorOnSurface} on:draw={(e) => onDraw(item, e)} on:tap={selectIcon(item)} />
                </gridlayout>
            </Template>
        </collectionview>
    </gridlayout>
</gesturerootview>
<!-- </page> -->
