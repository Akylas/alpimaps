<script context="module" lang="ts">
    import { Align, LayoutAlignment, Paint, StaticLayout, Style } from '@nativescript-community/ui-canvas';

    import { Pager } from '@nativescript-community/ui-pager';
    import { Color, GridLayout, ObservableArray } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';

    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { convertElevation, formatDistance, getAddress } from '~/helpers/formatter';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { colors, fonts } from '~/variables';
    const PAGER_PEAKING = 60;
    const PAGER_PAGE_PADDING = 20;

    const ICONS = {
        wheelchair: 'mdi-wheelchair',
        toilets: 'mdi-toilet',
        tents: 'mdi-tent',
        shower: 'mdi-shower-head',
        power_supply: 'mdi-flash',
        // dog: 'mdi-dog-side',
        // motorhome: 'mdi-van-passenger',
        static_caravans: 'mdi-caravan'
    };
    const ICONS_KEYS = Object.keys(ICONS);
</script>

<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import type { ElementClickData, FeatureClickData } from '~/mapModules/MapModule';
    import { openUrl } from '@nativescript/core/utils';
    import { compose } from '@nativescript/email';
    import { openLink } from '@shared/utils/ui';
    import { Point } from 'geojson';
    import { IItem } from '~/models/Item';
    import { packageService } from '~/services/PackageService';
    import Pill from '../common/Pill.svelte';
    import OpenStateChip from '../items/OpenStateChip.svelte';
    import { showToolTip } from '~/utils/ui';
    import { showBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { getDistanceSimple } from '~/helpers/geolib';
    import { isEInk } from '~/helpers/theme';
    import { onDestroy, onMount } from 'svelte';
    import { registerMapModule, unregisterMapModule } from '~/mapModules/registry';

    $: ({ colorOnSurface, colorOnSurfaceVariant, colorPrimary } = $colors);

    // mounted lazily, after the map registers its modules, so it registers itself;
    // after directionsPanel, which keeps the onVectorTileClicked dispatch order
    onMount(() => registerMapModule('mapResultsPager', { onVectorTileClicked, onVectorElementClicked }));
    onDestroy(() => unregisterMapModule('mapResultsPager'));

    export let items: IItem<Point>[] = [];

    export let selectedPageIndex: number = 0;

    export let stepIndex = 0;

    let oItems: ObservableArray<IItem<Point>>;
    let pendingStepIndex;
    let clearSearchTextOnHide = true;
    $: {
        DEV_LOG && console.log('MapResults changed', items.length);
        oItems = new ObservableArray<IItem<Point>>(items);
        if (items.length) {
            if (!pager) {
                pendingStepIndex = 1;
            } else {
                stepIndex = 1;
            }
        } else {
            clearSearchTextOnHide = false;
            stepIndex = 0;
        }
    }

    $: if (pager && pendingStepIndex) {
        stepIndex = pendingStepIndex;
    }

    let pager: NativeViewElementNode<Pager>;
    let gridLayout: NativeViewElementNode<GridLayout>;

    export function getNativeView() {
        return gridLayout && gridLayout.nativeView;
    }

    // const topProps = ['population', 'wheelchair', 'atm', 'change_machine', 'copy_facility', 'stamping_machine', 'currency', 'ele', 'currency:XLT', 'cuisine'];
    function getItemSpans(item) {
        const toDraw = [];

        const itemProperties = item.properties;

        const icons = ICONS_KEYS.filter((k) => itemProperties[k] === 'yes');
        const fontFamily = $fonts.mdi;
        if (icons.length) {
            toDraw.push({
                text: icons.map((i) => ICONS[i]).join('') + ' ',
                fontFamily
            });
        }

        Object.keys(itemProperties).forEach((k) => {
            // if (topProps.indexOf(k) !== -1) {
            switch (k) {
                case 'ele':
                    if (item.properties.class === 'natural') {
                        toDraw.push(
                            {
                                text: ' mdi-triangle-outline' + ' ',
                                fontFamily
                            },
                            {
                                text: convertElevation(itemProperties.ele) + ' '
                            }
                        );
                    }
                    break;
                case 'currency:XLT':
                case 'currency':
                    toDraw.push(
                        {
                            text: ' mdi-currency-eur' + ' ',
                            fontFamily
                        },
                        {
                            text: (itemProperties[k] + '').toLowerCase()
                        }
                    );
                    break;
                case 'cuisine':
                    toDraw.push(
                        {
                            text: ' mdi-food' + ' ',
                            fontFamily
                        },
                        {
                            text: itemProperties[k]
                        }
                    );
                    break;
                default:
                    break;
            }
            // }
        });
        return toDraw;
    }
    const textPaint = new Paint();
    const iconPaint = new Paint();
    iconPaint.setTextAlign(Align.CENTER);
    const tilePaint = new Paint();
    const CARD_PADDING = 14;
    const TILE_SIZE = 40;
    // the search list's row, grown into a card: tinted icon tile, title and distance, the address, then
    // the details and opening hours above the action pills
    function onDraw(item, { canvas }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const pad = CARD_PADDING;
            const itemProps = item.properties;
            const tint = item.style?.color || colorPrimary;
            tilePaint.setStyle(isEInk ? Style.STROKE : Style.FILL);
            tilePaint.color = isEInk ? colorOnSurface : new Color(tint).setAlpha(36).hex;
            canvas.drawRoundRect(pad, pad, pad + TILE_SIZE, pad + TILE_SIZE, 12, 12, tilePaint);
            const own = itemProps?.icon || item.icon || item.style?.icon;
            const { icon, fontFamily } = own ? { icon: own, fontFamily: itemProps?.fontFamily || 'osm' } : formatter.getItemIcon(item);
            if (icon) {
                iconPaint.textSize = 20;
                iconPaint.fontFamily = fontFamily;
                iconPaint.color = isEInk ? colorOnSurface : tint;
                const metrics = iconPaint.getFontMetrics();
                canvas.drawText(icon, pad + TILE_SIZE / 2, pad + TILE_SIZE / 2 - (metrics.ascent + metrics.descent) / 2, iconPaint);
            }

            textPaint.textSize = 12;
            textPaint.color = colorOnSurfaceVariant;
            if (item.distance) {
                textPaint.setTextAlign(Align.RIGHT);
                canvas.drawText(formatDistance(item.distance), w - pad, pad + 14, textPaint);
                textPaint.setTextAlign(Align.LEFT);
            }

            textPaint.textSize = 13;
            if (itemProps?.['address']) {
                const address = getAddress(item);
                const staticLayout = new StaticLayout(address.join(' '), textPaint, w - 2 * pad, LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
                canvas.save();
                canvas.translate(pad, pad + TILE_SIZE + 8);
                staticLayout.draw(canvas);
                canvas.restore();
            }

            // one row above the pills: the open state chip on the left, the details on the right
            const spans = getItemSpans(item);
            if (spans.length) {
                const nString = createNativeAttributedString({ spans });
                textPaint.color = colorOnSurfaceVariant;
                const staticLayout = new StaticLayout(nString, textPaint, w - 2 * pad, LayoutAlignment.ALIGN_OPPOSITE, 1, 0, true);
                canvas.save();
                canvas.translate(pad, h - 76);
                staticLayout.draw(canvas);
                canvas.restore();
            }
        } catch (err) {
            console.error(err, err.stack);
        }
    }
    const mapContext = getMapContext();

    async function getItemDetails(item) {
        const itemsModule = mapContext.mapModule('items');
        const details = await itemsModule.fetchOSMDetails(item, mapContext.getMap().camera().zoom());
        if (details) {
            return { ...item, properties: { ...item.properties, ...details.properties } };
        }
    }

    function getItemActions(item) {
        const newItems = [
            {
                id: 'info',
                title: lc('save'),
                icon: 'mdi-information-outline'
            },
            {
                id: 'add_map',
                icon: 'mdi-map-plus'
            }
        ] as any[];

        const itemProperties = item?.properties;
        if (!itemProperties) {
            return newItems;
        }

        Object.keys(itemProperties).forEach((k) => {
            if (k === 'phone' || k === 'contact:phone') {
                newItems.push({
                    id: 'phone',
                    title: lc('phone'),
                    subtitle: itemProperties[k],
                    icon: 'mdi-phone'
                });
                newItems.push({
                    id: 'sms',
                    title: lc('sms'),
                    subtitle: itemProperties[k],
                    icon: 'mdi-message-text'
                });
            }
            if (k === 'email' || k === 'contact:email') {
                newItems.push({
                    id: 'email',
                    title: lc('email'),
                    subtitle: itemProperties[k],
                    icon: 'mdi-email'
                });
            }
            if (k === 'website' || k === 'contact:website') {
                itemProperties[k].split(';').forEach((i) => {
                    newItems.push({
                        id: 'website',
                        title: lc('website'),
                        subtitle: i,
                        icon: 'mdi-web'
                    });
                });
            }
            if (k === 'wikipedia') {
                newItems.push({
                    id: 'wikipedia',
                    title: lc('wikipedia'),
                    wikipedia: itemProperties[k],
                    subtitle: itemProperties[k],
                    icon: 'mdi-wikipedia'
                });
            }
            if (k === 'wikidata') {
                newItems.push({
                    id: 'wikidata',
                    title: lc('wikidata'),
                    wikidata: itemProperties[k],
                    subtitle: itemProperties[k],
                    icon: 'mdi-barcode'
                });
            }
            if (k === 'mapillary') {
                newItems.push({
                    id: 'mapillary',
                    title: lc('mapillary'),
                    subtitle: itemProperties[k],
                    icon: 'mdi-navigation-variant-outline'
                });
            }
        });

        const devMode = mapContext.mapModule('customLayers').devMode;
        if (devMode) {
            newItems.push({
                type: 'json',
                id: 'json',
                src: JSON.stringify(item, null, 4)
            });
        }
        return newItems;
    }
    function onCardTap(item, e) {
        mapContext.selectItem({ item, isFeatureInteresting: true, minZoom: 17, setSelected: false, preventZoom: false, peek: false });
        const index = oItems.findIndex((i) => i === item);
        if (index !== -1 && index !== selectedPageIndex) {
            selectedPageIndex = index;
        }
    }

    async function onPageSelectedChange(e) {
        selectedPageIndex = e['value'];
        const item = oItems.getItem(selectedPageIndex);
        // DEV_LOG && console.log('onPageSelectedChange', selectedPageIndex, item);
        if (!item) {
            return;
        }

        mapContext.selectItem({ item, isFeatureInteresting: true, minZoom: 10, setSelected: false, preventZoom: false, peek: false });
        const itemProperties = item.properties;
        if (!itemProperties.osmid || !itemProperties.address) {
            const itemToChangeIndex = selectedPageIndex;
            const addressIndex = itemProperties.osmid ? 0 : 1;
            try {
                const toUpdate = await Promise.all(
                    [].concat(itemProperties.osmid ? [] : [getItemDetails(item).catch((e) => {})]).concat(itemProperties.address ? [] : [packageService.getItemAddress(item)])
                );
                const newItem = toUpdate[0] ?? item;
                if (toUpdate[addressIndex]) {
                    newItem.properties.address = toUpdate[addressIndex];
                }
                oItems.setItem(itemToChangeIndex, newItem);

                const canvasView: CanvasView = pager.nativeView.getViewForItemAtIndex(itemToChangeIndex)?.getViewById('canvas');
                canvasView?.redraw();
            } catch (error) {
                console.error(error);
            }
        }
    }

    async function onButtonTap(listItem, item, event) {
        DEV_LOG && console.log('onButtonTap', listItem);
        try {
            switch (listItem.id) {
                case 'info':
                    await showInformation(item);
                    break;
                case 'add_map':
                    await mapContext.saveItem(item);
                    break;
                case 'website':
                    await openLink(listItem.subtitle);
                    break;
                case 'phone':
                    openUrl('tel:' + listItem.subtitle);
                    break;
                case 'opening_hours':
                    // const data = openingHoursText(item);

                    break;
                case 'email':
                    await compose({
                        to: [listItem.subtitle]
                    });
                    break;
                case 'wikipedia':
                    await openLink(`https://en.wikipedia.org/wiki/${listItem.subtitle}`);
                    break;
                case 'wikidata':
                    await openLink(`https://www.wikidata.org/wiki/${listItem.subtitle}`);
                    break;
                case 'mapillary':
                    await openLink(`https://www.mapillary.com/app/?pKey=${listItem.subtitle}&focus=photo`);
                    break;
                case 'network':
                case 'operator':
                    // case 'wikidata':
                    if (listItem.wikidata) {
                        await openLink(`https://www.wikidata.org/wiki/${listItem.wikidata}`);
                    }
                    break;
                case 'sms':
                    openUrl('sms:' + listItem.subtitle);
                    break;
            }
        } catch (err) {
            showError(err);
        }
    }
    function bottomSheetTranslationFunction(translation, maxTranslation, progress) {
        const result = {
            bottomSheet: {
                translateY: translation
            }
        };
        return result;
    }
    function onAnimated(e) {
        DEV_LOG && console.log('onAnimated', e.position);
        if (!clearSearchTextOnHide) {
            clearSearchTextOnHide = true;
            return;
        }
        if (e.position === 0) {
            oItems = new ObservableArray([]);
            mapContext.clearSearch();
        }
    }

    export function onVectorTileClicked(data: FeatureClickData) {
        const { featurePosition } = data;
        const index = oItems.findIndex((i) => getDistanceSimple(i.geometry.coordinates, featurePosition) <= 10);
        DEV_LOG && console.log('onVectorTileClicked', featurePosition, oItems.length, index);
        if (index >= 0) {
            selectedPageIndex = index;
            return true;
        }
    }

    export function onVectorElementClicked(data: ElementClickData) {
        const { elementPosition } = data;
        const index = oItems.findIndex((i) => getDistanceSimple(i.geometry.coordinates, elementPosition) <= 10);
        DEV_LOG &&
            console.log(
                'onVectorElementClicked',
                elementPosition,
                oItems.length,
                index,
                oItems.map((i) => getDistanceSimple(i.geometry.coordinates, elementPosition))
            );
        if (index >= 0) {
            selectedPageIndex = index;
            return true;
        }
    }

    async function showInformation(item) {
        try {
            // if (!item.properties?.osmid && !networkService.connected) {
            //     throw new NoNetworkError();
            // }
            const ItemInfo = (await import('~/components/items/ItemInfo.svelte')).default;
            // const hasOpenHours = !!item.properties?.opening_hours;
            const hasOpenHours = __ANDROID__;
            await showBottomSheet({
                parent: mapContext.getMainPage(),
                view: ItemInfo,
                peekHeight: hasOpenHours ? 350 : undefined,
                props: {
                    item,
                    openHoursExpanded: true,
                    height: hasOpenHours ? undefined : 350
                }
            });
        } catch (error) {
            showError(error);
        }
    }
</script>

<bottomsheet
    bind:this={gridLayout}
    id="mapResultsBottomsheet"
    {...$$restProps}
    height={200}
    panGestureOptions={{ failOffsetXStart: -20, failOffsetXEnd: 20, minDist: 40 }}
    {stepIndex}
    steps={[0, 200]}
    translationFunction={bottomSheetTranslationFunction}
    visibility={oItems.length > 0 ? 'visible' : 'collapse'}
    on:animated={onAnimated}>
    <pager
        bind:this={pager}
        disableAnimation={isEInk}
        height={200}
        items={oItems}
        peaking={PAGER_PEAKING}
        preserveIndexOnItemsChange={true}
        selectedIndex={selectedPageIndex}
        width="100%"
        prop:bottomSheet
        on:selectedIndexChange={onPageSelectedChange}>
        <Template let:index let:item>
            <gridlayout padding={PAGER_PAGE_PADDING - 10}>
                <canvasview id="canvas" class="cardview" borderRadius={20} on:draw={(e) => onDraw(item, e)} on:tap={(e) => onCardTap(item, e)}>
                    <label
                        autoFontSize={true}
                        color={colorOnSurface}
                        fontSize={16}
                        fontWeight="bold"
                        height={TILE_SIZE + 4}
                        margin={`${CARD_PADDING - 2} 70 0 ${CARD_PADDING + TILE_SIZE + 12}`}
                        maxFontSize={16}
                        maxLines={2}
                        text={item.title}
                        verticalAlignment="top"
                        verticalTextAlignment="middle" />
                    <OpenStateChip checkable={false} horizontalAlignment="left" {item} marginBottom={58} marginLeft={CARD_PADDING} verticalAlignment="bottom" />
                    <!-- the actions as pills, the save one labelled -->
                    <scrollview margin="0 8 6 8" orientation="horizontal" scrollBarIndicatorVisible={false} verticalAlignment="bottom">
                        <stacklayout orientation="horizontal">
                            {#each getItemActions(item) as buttonItem (buttonItem.id + (buttonItem.subtitle || ''))}
                                <Pill
                                    icon={buttonItem.icon}
                                    label={buttonItem.id === 'add_map' ? lc('save') : null}
                                    primary={buttonItem.id === 'add_map'}
                                    on:tap={(e) => onButtonTap(buttonItem, item, e)}
                                    on:longPress={() => buttonItem.title && showToolTip(buttonItem.title)} />
                            {/each}
                        </stacklayout>
                    </scrollview>
                </canvasview>
            </gridlayout>
        </Template>
    </pager>
</bottomsheet>
