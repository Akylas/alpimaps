<script context="module" lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { ApplicationSettings, Utils } from '@nativescript/core';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { UNITS, convertDurationSeconds, convertElevation, convertValueToUnit, formatDistance, openingHoursText, osmicon } from '~/helpers/formatter';
    import { onMapLanguageChanged } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import type { IItem as Item, ItemProperties } from '~/models/Item';
    import { valhallaSettingColor, valhallaSettingIcon } from '~/utils/routing';
    import { colors, fontScaleMaxed, fonts, onFontScaleChanged } from '~/variables';
    import SymbolShape from '../common/SymbolShape';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onThemeChanged } from '~/helpers/theme';

    const propsPaint = new Paint();
    propsPaint.textSize = 13;
    propsPaint.setTextAlign(Align.LEFT);

    const iconPaint = new Paint();
    iconPaint.setTextAlign(Align.CENTER);
</script>

<script lang="ts">
    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);
    export let item: Item;
    export let symbolSize = 34;
    export let subtitleEnabled = true;
    export let selectable = true;
    export let marginLeft = 40;
    export let marginTop = null;
    export let marginBottom = 18;
    export let titleVerticalTextAlignment = null;
    export let symbolLeft = 0;
    export let symbolTop = 8;
    export let propsLeft = 0;
    export let propsBottom = 18;
    export let props2Bottom = 18;
    export let iconColor = null;
    export let iconSize = 24;
    export let iconLeft = 15;
    export let iconTop = 30;
    export let showIcon = true;
    export let onDraw: (event: { canvas: Canvas; object: CanvasView }) => void = null;
    export let rightTextPadding = 0;
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
    let nString3;

    function redrawIcon() {
        canvas?.nativeView?.invalidate();
    }
    onFontScaleChanged(redrawIcon);
    onThemeChanged(redrawIcon);

    const itemsModule = getMapContext().mapModule('items');
    itemsModule.on('user_onroute_data', (event: any) => {
        if (!item || !ApplicationSettings.getBoolean('draw_onroute_live_data', false)) {
            nString3 = null;
            return;
        }
        if (event.remainingDistance) {
            nString3 = createNativeAttributedString({
                spans: (event.remainingDistanceToStep
                    ? [
                          {
                              fontFamily: $fonts.mdi,
                              color: colorPrimary,
                              text: 'mdi-map-marker'
                          },
                          {
                              text: ' ' + formatDistance(event.remainingDistanceToStep)
                          },
                          {
                              text: '\n'
                          }
                      ]
                    : []
                )
                    .concat([
                        {
                            fontFamily: $fonts.mdi,
                            color: colorPrimary,
                            text: 'mdi-flag-checkered'
                        },
                        {
                            text: ' ' + formatDistance(event.remainingDistance)
                        }
                    ] as any)
                    //   .concat(isNaN(event.remainingTime) ? [] : [
                    //       {
                    //           text: '\n'
                    //       },
                    //       {
                    //           fontFamily: $fonts.mdi,
                    //           color: colorPrimary,
                    //           text: 'mdi-timer-outline'
                    //       },
                    //       {
                    //           text: ' ' + convertDurationSeconds(event.remainingTime)
                    //       }
                    //   ] as any)
                    .concat(
                        !isNaN(event.itemData.dp) && event.dplus - event.itemData.dp > 0
                            ? ([
                                  {
                                      text: '\n'
                                  },
                                  {
                                      fontFamily: $fonts.mdi,
                                      color: colorPrimary,
                                      text: 'mdi-arrow-top-right'
                                  },
                                  {
                                      text: ' ' + convertElevation(event.dplus - event.itemData.dp)
                                  }
                              ] as any)
                            : []
                    )
            });
        } else {
            nString3 = null;
        }
        canvas?.nativeView.invalidate();
    });

    onMapLanguageChanged((lang) => updateItemText(item, lang));
    function updateItemText(it: Item = item, lang?: string) {
        if (!it) {
            return;
        }
        const title = formatter.getItemName(it, lang);
        itemTitle = formatter.getItemTitle(it, lang);
        itemSubtitle = formatter.getItemSubtitle(it, title);
    }
    function updateItem(it: Item = item) {
        if (!it) {
            nString = null;
            nString2 = null;
            nString3 = null;
            return;
        }
        itemProps = it?.properties;
        itemIsRoute = !!it?.route;
        if (itemIsRoute && itemProps.route && (itemProps.route.type === 'pedestrian' || itemProps.route.type === 'bicycle')) {
            itemIconFontFamily = $fonts.app;
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

        showSymbol = itemIsRoute && (itemProps?.layer === 'route' || itemProps?.layer === 'routes');
        actualShowSymbol = showSymbol && (itemProps.symbol || itemProps.network);
        const spans = [];

        if (!itemIsRoute && itemProps?.hasOwnProperty('ele')) {
            spans.push(
                {
                    text: 'mdi-triangle-outline' + ' ',
                    fontFamily: $fonts.mdi,
                    color: colorOnSurfaceVariant
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
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
                    },
                    {
                        text: `${formatDistance(route.totalDistance || itemProps.distance * 1000)}` + ' '
                    }
                );
            }

            if (route.totalTime) {
                spans.push(
                    {
                        text: 'mdi-timer-outline' + ' ',
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
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
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
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
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
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
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
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
                        fontFamily: $fonts.mdi,
                        color: colorOnSurfaceVariant
                    },
                    {
                        text: `${convertElevation(-profile.dmin)}` + ' '
                    }
                );
            }
        }

        if (spans.length > 0) {
            nString = createNativeAttributedString({ spans });
        } else {
            nString = null;
        }
        if (itemIsRoute && item.route.costing_options) {
            let options = item.route.costing_options;
            const profile = item.properties.route.type;
            options = options[profile] || options;
            const spans2 = [];
            Object.entries<number>(options).forEach((v) => {
                const k = v[0];
                if (valhallaSettingIcon[k] && v[1] > 0) {
                    spans2.push({
                        text: valhallaSettingIcon[k],
                        fontFamily: $fonts.mdi,
                        color: valhallaSettingColor(k, profile, options, colorOnSurfaceVariant)
                    });
                }
            });
            if (spans2.length > 0) {
                nString2 = createNativeAttributedString({ spans: spans2 });
            } else {
                nString2 = null;
            }
        } else {
            nString2 = null;
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
    function onCanvasDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        if (!item) {
            return;
        }
        try {
            const paddingLeft = Utils.layout.toDeviceIndependentPixels(object.effectivePaddingLeft);
            const paddingTop = Utils.layout.toDeviceIndependentPixels(object.effectivePaddingTop);
            const w = canvas.getWidth() - paddingLeft - Utils.layout.toDeviceIndependentPixels(object.effectivePaddingRight);
            const h = canvas.getHeight() - paddingTop - Utils.layout.toDeviceIndependentPixels(object.effectivePaddingBottom);
            if (onDraw) {
                onDraw({ canvas, object });
            }
            if (showIcon && itemIcon && !actualShowSymbol) {
                const fontSize = iconSize * $fontScaleMaxed;
                iconPaint.textSize = fontSize;
                iconPaint.fontFamily = itemIconFontFamily;
                iconPaint.color = iconColor || colorOnSurface;
                canvas.drawText(itemIcon, paddingLeft + iconLeft, iconTop + fontSize / 2, iconPaint);
            }

            propsPaint.setTextAlign(Align.LEFT);
            propsPaint.color = colorOnSurface;
            if (nString) {
                propsPaint.textSize = 13 * $fontScaleMaxed;
                const staticLayout = new StaticLayout(nString, propsPaint, w, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                canvas.save();
                canvas.translate(paddingLeft + propsLeft, paddingTop + h - propsBottom * Math.sqrt($fontScaleMaxed));
                staticLayout.draw(canvas);
                canvas.restore();
            }
            if (nString2) {
                propsPaint.textSize = 14 * $fontScaleMaxed;
                const staticLayout = new StaticLayout(nString2, propsPaint, w, LayoutAlignment.ALIGN_OPPOSITE, 1, 0, true);
                canvas.save();
                canvas.translate(paddingLeft, paddingTop + h - props2Bottom * Math.sqrt($fontScaleMaxed));
                staticLayout.draw(canvas);
                canvas.restore();
            }

            if (nString3) {
                propsPaint.textSize = 11 * $fontScaleMaxed;
                const staticLayout = new StaticLayout(nString3, propsPaint, w, LayoutAlignment.ALIGN_OPPOSITE, 1, 0, true);
                canvas.save();
                canvas.translate(paddingLeft, paddingTop);
                staticLayout.draw(canvas);
                canvas.restore();
            }
            if (item.properties?.['opening_hours']) {
                propsPaint.textSize = 13 * $fontScaleMaxed;
                const data = openingHoursText(item);
                propsPaint.color = data.color;
                propsPaint.setTextAlign(Align.RIGHT);
                canvas.drawText(data.text, paddingLeft + w, paddingTop + h - 3, propsPaint);
            }
            if (actualShowSymbol) {
                SymbolShape.drawSymbolOnCanvas(canvas, {
                    width: symbolSize,
                    height: symbolSize,
                    left: paddingLeft + symbolLeft,
                    top: paddingTop + symbolTop,
                    color: itemProps?.color || colorOnSurface,
                    symbol: formatter.getSymbol(itemProps),
                    scale: $fontScaleMaxed,
                    maxFontSize: 18
                });
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }
</script>

<canvasview bind:this={canvas} padding="4 10 2 10" on:draw={onCanvasDraw} {...$$restProps} disableCss={true} on:tap on:longPress>
    <slot />
    <flexlayout disableCss={true} flexDirection="column" {marginBottom} {marginLeft} marginRight={rightTextPadding} {marginTop} ios:verticalAlignment="center">
        <label
            autoFontSize={true}
            color={colorOnSurface}
            disableCss={true}
            flexGrow={1}
            fontSize={18 * $fontScaleMaxed}
            fontWeight="bold"
            maxFontSize={18 * $fontScaleMaxed}
            {selectable}
            text={itemTitle}
            textWrap={true}
            verticalTextAlignment={titleVerticalTextAlignment || (itemSubtitle ? 'bottom' : 'middle')} />
        {#if subtitleEnabled}
            <label
                color={colorOnSurfaceVariant}
                disableCss={true}
                flexGrow={1}
                flexShrink={0}
                fontSize={13 * $fontScaleMaxed}
                maxLines={2}
                {selectable}
                text={itemSubtitle}
                verticalTextAlignment="top"
                visibility={itemSubtitle ? 'visible' : 'collapse'} />
        {/if}
    </flexlayout>
    <slot name="above" />
</canvasview>
