<script lang="ts">
    import { Canvas, CanvasView, LayoutAlignment, Paint, Rect, StaticLayout } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { EventData, Page, Utils, View } from '@nativescript/core';
    import { navigate } from 'svelte-native';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { transitService } from '~/services/TransitService';
    import { NoNetworkError, showError } from '~/utils/error';
    import { fonts, navigationBarHeight } from '~/variables';

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
        const w = canvas.getWidth();
        const h = canvas.getHeight();
        if (!backgroundPaint) {
            backgroundPaint = new Paint();
        }
        if (!textPaint) {
            textPaint = new Paint();
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
            const staticLayout = new StaticLayout(text, textPaint, itemWidth, LayoutAlignment.ALIGN_CENTER, 1, 0, true);
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
            navigate({ page: component, props: { line } });
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
    <gridlayout rows="auto,*" on:layoutChanged={onLayoutChanged}>
        <collectionview items={dataItems} row={1} android:marginBottom={$navigationBarHeight}>
            <Template let:item>
                <stacklayout>
                    <label fontSize={18} padding={10} text={item.type} />
                    <canvaslabel height={getItemHeight(item)} on:draw={(event) => drawItem(item, event)} on:tap={(event) => onTap(item, event)} />
                </stacklayout>
            </Template>
        </collectionview>
        <mdactivityindicator busy={loading} row={1} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel row={1} v->
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
        <CActionBar title={lc('lines')} />
    </gridlayout>
</page>
