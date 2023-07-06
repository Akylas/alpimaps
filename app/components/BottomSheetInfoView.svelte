<script lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { convertDurationSeconds, convertElevation, convertValueToUnit, osmicon, UNITS } from '~/helpers/formatter';
    import { onMapLanguageChanged } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import type { IItem as Item, ItemProperties } from '~/models/Item';
    import { valhallaSettingColor, valhallaSettingIcon } from '~/utils/routing';
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
    let nString2;

    onMapLanguageChanged((lang) => updateItemText(item, lang));
    function updateItemText(it: Item = item, lang?: string) {
        if (!it) {
            return;
        }
        // console.log('updateItemText1', getMapContext().getCurrentLanguage(), it)
        itemTitle = formatter.getItemTitle(it, lang);
        itemSubtitle = formatter.getItemSubtitle(it, itemTitle);
    }
    function updateItem(it: Item = item) {
        if (!it) {
            nString = null;
            nString2 = null;
            return;
        }
        itemProps = it?.properties;
        itemIsRoute = !!it?.route;
        if (itemIsRoute && itemProps.route && (itemProps.route.type === 'pedestrian' || itemProps.route.type === 'bicycle')) {
            itemIconFontFamily = alpimapsFontFamily;
            itemIcon = formatter.getRouteIcon(itemProps.route.type, itemProps.route.subtype);
        } else {
            if (itemProps?.fontFamily) {
                itemIconFontFamily = itemProps.fontFamily;
                itemIcon = itemProps.icon;
            } else {
                itemIconFontFamily = 'osm';
                itemIcon = osmicon(formatter.geItemIcon(it));
            }
        }
        updateItemText(it);

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
            const route = it.route;
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
        const profile = it.profile;
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
            const profile = it.profile;
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
        if (itemIsRoute && item.route.costing_options) {
            let options = item.route.costing_options;
            const profile = item.properties.route.type;
            options = options[profile] || options;
            let spans2 = [];
            Object.entries<number>(options).forEach((v) => {
                const k = v[0];
                if (valhallaSettingIcon[k] && v[1] > 0) {
                    spans2.push({
                        text: valhallaSettingIcon[k],
                        fontFamily: mdiFontFamily,
                        color: valhallaSettingColor(k, profile, options, $subtitleColor)
                    });
                }
            });
            if (spans2.length > 0) {
            nString2 = createNativeAttributedString({ spans:spans2 });
        }
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
            if (itemIcon && !actualShowSymbol) {
                if (!iconPaint) {
                    iconPaint = new Paint();
                    iconPaint.textSize = iconSize;
                }
                iconPaint.fontFamily = itemIconFontFamily;
                iconPaint.color = iconColor || $textColor;
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
            if (nString2) {
                if (!propsPaint) {
                    propsPaint = new Paint();
                    propsPaint.textSize = 14;
                }
                propsPaint.color = $textColor;
                const staticLayout = new StaticLayout(nString2, propsPaint, canvas.getWidth(), LayoutAlignment.ALIGN_OPPOSITE, 1, 0, true);
                canvas.save();
                canvas.translate(0, h - 20);
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
