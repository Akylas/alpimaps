<script lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { convertDurationSeconds, convertElevation, convertValueToUnit, osmicon, UNITS } from '~/helpers/formatter';
    import { formatter } from '~/mapModules/ItemFormatter';
    import type { IItem as Item, ItemProperties } from '~/models/Item';
    import { alpimapsFontFamily, mdiFontFamily, subtitleColor, textColor } from '~/variables';

    export let item: Item;
    export let symbolSize = 34;
    export let marginLeft = 40;
    export let symbolLeft = 0;
    export let symbolTop = 8;
    export let propsLeft = 0;
    export let iconColor = null;
    export let iconSize = 24;
    export let iconLeft = 5;
    export let iconTop = 35;
    export let onDraw: (event: { canvas: Canvas; object: CanvasView }) => void = null;
    let canvas: NativeViewElementNode<CanvasView>;

    let itemIcon: string = null;
    let itemIconFontFamily = 'osm';
    let itemTitle: string = null;
    let itemSubtitle: string = null;
    let showSymbol: boolean = false;
    let actualShowSymbol = false;
    let itemIsRoute = false;
    let itemProps: ItemProperties = null;

    let nString;

    function updateItem(item: Item) {
        if (!item) {
            nString = null;
            return;
        }
        itemProps = item?.properties;
        itemIsRoute = !!item?.route;
        if (itemIsRoute && itemProps.route && (itemProps.route.type === 'pedestrian' || itemProps.route.type === 'bicycle')) {
            itemIconFontFamily = alpimapsFontFamily;
            itemIcon = formatter.getRouteIcon(itemProps.route.type, itemProps.route.subtype);
        } else {
            itemIconFontFamily = 'osm';
            itemIcon = osmicon(formatter.geItemIcon(item));
        }
        itemTitle = formatter.getItemTitle(item);
        itemSubtitle = formatter.getItemSubtitle(item);
        showSymbol = itemIsRoute && itemProps?.layer === 'route';
        actualShowSymbol = showSymbol && (itemProps.symbol || itemProps.network);
        let spans = [];

        if (!itemIsRoute && itemProps?.hasOwnProperty('ele')) {
            spans.push(
                {
                    text: 'mdi-triangle-outline' + ' ',
                    fontFamily: mdiFontFamily,
                    color: $subtitleColor
                },
                {
                    text: convertElevation(itemProps.ele) + ' '
                }
            );
        }

        if (itemIsRoute) {
            const route = item.route;
            if (route.totalDistance || itemProps?.hasOwnProperty('distance')) {
                spans.push(
                    {
                        text: 'mdi-arrow-left-right' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: `${convertValueToUnit(route.totalDistance || itemProps.distance * 1000, UNITS.DistanceKm).join(' ')}` + ' '
                    }
                );
            }

            if (route.totalTime) {
                spans.push(
                    {
                        text: 'mdi-timer-outline' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: convertDurationSeconds(route.totalTime) + ' '
                    }
                );
            }
        }
        const profile = item.profile;
        const hasProfile = !!profile?.max;
        if (!hasProfile) {
            if (itemProps?.ascent > 0) {
                spans.push(
                    {
                        text: 'mdi-arrow-top-right' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: `${convertElevation(itemProps.ascent)}` + ' '
                    }
                );
            }
            if (itemProps?.descent > 0) {
                spans.push(
                    {
                        text: 'mdi-arrow-bottom-right' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: `${convertElevation(itemProps.descent)}` + ' '
                    }
                );
            }
        } else {
            const profile = item.profile;
            if (profile.dplus > 0) {
                spans.push(
                    {
                        text: 'mdi-arrow-top-right' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: `${convertElevation(profile.dplus)}` + ' '
                    }
                );
            }
            if (profile.dmin < 0) {
                spans.push(
                    {
                        text: 'mdi-arrow-bottom-right' + ' ',
                        fontFamily: mdiFontFamily,
                        color: $subtitleColor
                    },
                    {
                        text: `${convertElevation(-profile.dmin)}` + ' '
                    }
                );
            }
        }
        if (spans.length > 0) {
            nString = createNativeAttributedString({ spans });
        }
        canvas?.nativeView.invalidate();
    }
    $: {
        try {
            updateItem(item);
        } catch (err) {
            console.error('updateItem', err, err.stack);
        }
    }
    let propsPaint: Paint;
    let iconPaint: Paint;
    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();
            if (onDraw) {
                onDraw({ canvas, object });
            }
            if (itemIcon) {
                if (!iconPaint) {
                    iconPaint = new Paint();
                    iconPaint.textSize = iconSize;
                }
                iconPaint.fontFamily = itemIconFontFamily;
                iconPaint.color = itemProps?.color || iconColor || $textColor;
                canvas.drawText(itemIcon, iconLeft, iconTop, iconPaint);
            }

            if (nString) {
                if (!propsPaint) {
                    propsPaint = new Paint();
                    propsPaint.textSize = 14;
                }
                propsPaint.color = $textColor;
                const staticLayout = new StaticLayout(nString, propsPaint, canvas.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                canvas.save();
                canvas.translate(propsLeft, h - 20);
                staticLayout.draw(canvas);
                canvas.restore();
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }
</script>

<gridlayout {...$$restProps} padding="4 10 4 10">
    <slot />
    <canvas bind:this={canvas} on:draw={onCanvasDraw}>
        <symbolshape
            visibility={actualShowSymbol ? 'visible' : 'hidden'}
            symbol={actualShowSymbol ? formatter.getSymbol(itemProps) : null}
            color={itemProps?.color || $textColor}
            width={symbolSize}
            height={symbolSize}
            top={symbolTop}
            left={symbolLeft}
        />
    </canvas>
    <flexlayout {marginLeft} marginBottom={20} flexDirection="column">
        <label text={itemTitle} fontWeight="bold" color={$textColor} fontSize={18} autoFontSize={true} flexGrow={1} maxFontSize={18} verticalTextAlignment="middle" textWrap={true} />
        <label visibility={itemSubtitle ? 'visible' : 'collapsed'} text={itemSubtitle} color={$subtitleColor} fontSize={13} maxLines={2} verticalTextAlignment="top" flexGrow={1} flexShrink={0} />
    </flexlayout>
</gridlayout>
