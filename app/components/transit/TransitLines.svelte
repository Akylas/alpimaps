<script lang="ts">
    import { Canvas, CanvasView, LayoutAlignment, Paint, Rect, StaticLayout } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { EventData, Page, Utils, View } from '@nativescript/core';
    import { navigate } from 'svelte-native';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CActionBar from '~/components/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { NoNetworkError, onNetworkChanged } from '~/services/NetworkService';
    import { transitService } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { mdiFontFamily } from '~/variables';

    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let loading = false;
    let dataItems = null;
    let noNetworkAndNoData = false;

    const itemWidth = 50;
    const itemPadding = 10;
    const cellWidth = 2 * itemPadding + itemWidth;
    let width = 60;
    let itemsPerLine = 1;

    async function refresh() {
        try {
            const lines: { [k: string]: any } = await transitService.getMetroLinesData();
            const groups = Object.values(lines).reduce(function (acc, item) {
                if (!acc[item.type]) {
                    acc[item.type] = { type: item.type, items: [] };
                }
                acc[item.type].items.push(item);
                return acc;
            }, {});
            dataItems = Object.values(groups);
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !dataItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }

    function onLayoutChanged(event: EventData) {
        width = Utils.layout.toDeviceIndependentPixels((event.object as View).getMeasuredWidth());
        itemsPerLine = Math.floor(width / cellWidth);
        refresh();
    }

    // onMount(() => {
    //     focus();
    // });
    function onNavigatingTo(e) {}
    function getItemHeight(item) {
        return Math.ceil(item.items.length / itemsPerLine) * cellWidth;
    }
    let backgroundPaint: Paint;
    let textPaint: Paint;
    function drawItem(item, event: { canvas: Canvas; object: CanvasView }) {
        const canvas = event.canvas;
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        if (!backgroundPaint) {
            backgroundPaint = new Paint();
            backgroundPaint.setAntiAlias(true);
        }
        if (!textPaint) {
            textPaint = new Paint();
            textPaint.setAntiAlias(true);
        }
        const rect = new Rect(0, 0, 0, 0);
        item.items.forEach((i, index) => {
            canvas.save();
            const x = (index % itemsPerLine) * cellWidth + itemPadding;
            const y = Math.floor(index / itemsPerLine) * cellWidth + itemPadding;
            textPaint.setColor(i.textColor);
            backgroundPaint.setColor(i.color || 'white');
            canvas.drawRoundRect(x, y, x + itemWidth, y + itemWidth, 4, 4, backgroundPaint);
            const text = i.shortName;
            textPaint.setTextSize(20);
            textPaint.getTextBounds(text, 0, text.length, rect);
            const wantedFontSize = Math.min(30, Math.floor(((itemWidth - 10) / rect.width()) * 20));
            textPaint.setTextSize(wantedFontSize);
            let staticLayout = new StaticLayout(text, textPaint, itemWidth, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
            const height = staticLayout.getHeight();
            // staticLayout = new StaticLayout(text, textPaint, itemWidth, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
            canvas.translate(x, y + itemWidth / 2 - height / 2);
            staticLayout.draw(canvas);
            canvas.restore();
        });
    }

    async function onTap(item, event) {
        const index = Math.floor(event.getX() / cellWidth) + itemsPerLine * Math.floor(event.getY() / cellWidth);
        if (index === -1) {
            return;
        }
        const line = item.items[index];
        try {
            const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
            await navigate({ page: component, props: { line } });
        } catch (error) {
            showError(error);
        }
    }

    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });
</script>

<page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridLayout rows="auto,*" on:layoutChanged={onLayoutChanged} >
        <CActionBar title={lc('lines')} />
        <collectionview row={1} items={dataItems}>
            <Template let:item>
                <stacklayout>
                    <label fontSize="18" text={item.type} padding={10} />
                    <canvaslabel height={getItemHeight(item)} on:draw={(event) => drawItem(item, event)} on:tap={(event) => onTap(item, event)} />
                </stacklayout>
            </Template>
        </collectionview>
        <mdactivityindicator busy={loading} verticalAlignment="center" visibility={loading ? 'visible' : 'collapsed'} row={1} />
        {#if noNetworkAndNoData}
            <canvaslabel v- row={1}>
                <cgroup textAlignment="center" verticalAlignment="center">
                    <cspan text="mdi-alert-circle-outline" fontSize={50} fontFamily={mdiFontFamily} />
                    <cspan text={'\n' + lc('no_network')} fontSize={20} />
                </cgroup>
            </canvaslabel>
        {/if}
    </gridLayout>
</page>
