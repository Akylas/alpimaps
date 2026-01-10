<script lang="ts">
    import { openUrl } from '@akylas/nativescript/utils';
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color, LayoutBase, ObservableArray, View } from '@nativescript/core';
    import { compose } from '@nativescript/email';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { convertElevation, getAddress, openingHoursText, osmicon } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { networkService } from '~/services/NetworkService';
    import { showError } from '@shared/utils/showError';
    import { share } from '@akylas/nativescript-app-utils/share';
    import { openURL } from '~/utils/ui/index.common';
    import { actionBarButtonHeight, actionBarHeight, colors, fonts } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import JsonViewer from './JSONViewer.svelte';
    import ListItem2 from '../common/ListItem2.svelte';
    // import JSONViewer from '~/components/JSONViewer.svelte';
    let { colorBackground, colorOnSurface, colorOutlineVariant } = $colors;
    $: ({ colorBackground, colorOnSurface, colorOutlineVariant } = $colors);

    export let item: Item;
    export let openHoursExpanded = false;
    export let height: number | string = '100%';
    let extraProps = {};
    const mapContext = getMapContext();
    const borderPaint = new Paint();
    borderPaint.setColor(colorOutlineVariant);
    // paint.setStyle(Style.STROKE)
    borderPaint.setStrokeWidth(2);
    const textIconPaint = new Paint();
    textIconPaint.setTextAlign(Align.CENTER);
    textIconPaint.fontFamily = $fonts.mdi;

    let topItemsToDraw: {
        color?: string | Color;
        paint?: Paint;
        iconFontSize?: number;
        icon: string;
        value?: string | number;
        subvalue?: string;
    }[] = [];

    // $: itemColor = getStyleProperty(updatedProperties, 'color') || getStyleProperty(item.properties, 'color') || (itemIsRoute ? '#287bda' : '#60A5F4');
    // $: itemIcon = getStyleProperty(updatedProperties, 'icon') || getStyleProperty(item.properties, 'icon');
    // $: itemIcon = osmicon(formatter.geItemIcon(item));
    // $: itemIconFontFamily = 'osm';

    let items: ObservableArray<any>;
    function refreshItems() {
        // because of svelte async way itemIsRoute might not be set on opening
        const newItems = [];
        const itemProperties = item.properties;

        Object.keys(itemProperties).forEach((k) => {
            if (k === 'address') {
                const address = getAddress(item);
                newItems.push({
                    id: 'address',
                    title: lc('address'),
                    subtitle: address.join(' '),
                    leftIcon: 'mdi-map-marker'
                });
            }
            if (k === 'opening_hours') {
                const data = openingHoursText(item);
                newItems.push({
                    id: 'opening_hours',
                    title: lc('opening_hours'),
                    subtitle: data.text,
                    subtitleColor: data.color,
                    leftIcon: 'mdi-clock-outline',
                    expandable: true,
                    expanded: openHoursExpanded,
                    expandedHeight: 224,
                    opening_hours: data.oh
                });
            }
            if (k === 'phone' || k === 'contact:phone') {
                newItems.push({
                    id: 'phone',
                    title: lc('phone'),
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-phone',
                    rightIcon: 'mdi-message-text'
                });
            }
            if (k === 'email' || k === 'contact:email') {
                newItems.push({
                    id: 'email',
                    title: lc('email'),
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-email'
                });
            }
            if (k === 'website' || k === 'contact:website') {
                itemProperties[k].split(';').forEach((i) => {
                    newItems.push({
                        id: 'website',
                        title: lc('website'),
                        subtitle: i,
                        leftIcon: 'mdi-web'
                    });
                });
            }
            if (k === 'wikipedia') {
                newItems.push({
                    id: 'wikipedia',
                    title: lc('wikipedia'),
                    wikipedia: itemProperties[k],
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-wikipedia'
                });
            }
            if (k === 'wikidata') {
                newItems.push({
                    id: 'wikidata',
                    title: lc('wikidata'),
                    wikidata: itemProperties[k],
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-barcode'
                });
            }
            if (k === 'mapillary') {
                newItems.push({
                    id: 'mapillary',
                    title: lc('mapillary'),
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-navigation-variant-outline'
                });
            }
            if (k === 'network') {
                newItems.push({
                    id: 'network',
                    title: lc('network'),
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-train-car',
                    wikidata: itemProperties['network:wikidata'],
                    rightIcon: itemProperties['network:wikidata'] ? 'mdi-barcode' : undefined
                });
            }
            if (k === 'operator') {
                newItems.push({
                    id: 'operator',
                    title: lc('operator'),
                    subtitle: itemProperties[k],
                    leftIcon: 'mdi-train-car',
                    wikidata: itemProperties['operator:wikidata'],
                    rightIcon: itemProperties['operator:wikidata'] ? 'mdi-barcode' : undefined
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
            // const existing = newItems.map((i) => i.id);
            // const toAdd = Object.keys(itemProperties).filter((s) => existing.indexOf(s) === -1);
            // for (let index = 0; index < toAdd.length; index++) {
            //     const key = toAdd[index];
            //     newItems.push({
            //         id: key,
            //         height: 50,
            //         title: lc(key),
            //         subtitle: itemProperties[key] + '',
            //         leftIcon: 'mdi-tag-outline'
            //     });
            // }
        }
        items = new ObservableArray(newItems);

        const toDraw = [];
        Object.keys(itemProperties).forEach((k) => {
            if (topProps.indexOf(k) !== -1) {
                switch (k) {
                    case 'population':
                        toDraw.push({
                            icon: 'mdi-account-group',
                            value: itemProperties[k],
                            subvalue: lc('population')
                        });
                        break;
                    case 'wheelchair':
                        toDraw.push({
                            icon: 'mdi-wheelchair',
                            value: lc('wheelchair')
                        });
                        break;
                    case 'ele':
                        if (item.properties.class === 'natural') {
                            toDraw.push({
                                icon: 'mdi-triangle-outline',
                                value: convertElevation(itemProperties[k]),
                                subvalue: lc('elevation')
                            });
                        }
                        break;
                    case 'currency:XLT':
                    case 'currency':
                        toDraw.push({
                            icon: 'mdi-currency-eur',
                            value: (itemProperties[k] + '').toLowerCase()
                        });
                        break;
                    case 'cuisine':
                        itemProperties[k].split(',').forEach((value) =>
                            toDraw.push({
                                icon: 'mdi-food',
                                value: value.toLowerCase()
                            })
                        );
                        break;
                }
            }
        });
        topItemsToDraw = toDraw;
    }
    const itemsModule = mapContext.mapModule('items');

    const topProps = ['population', 'wheelchair', 'atm', 'change_machine', 'copy_facility', 'stamping_machine', 'currency', 'ele', 'currency:XLT', 'cuisine'];

    let loading = false;
    async function refresh(force = false) {
        try {
            const ignoredKeys = itemsModule.ignoredOSMKeys;
            const itemProperties = { ...item.properties };
            const needsSaving = !!item.id;
            DEV_LOG && console.log('refresh', needsSaving, item);
            // if (!itemProperties.osmid) {
            if (force || !itemProperties.osmid) {
                if (!force) {
                    refreshItems();
                }
                loading = true;
                const result = await itemsModule.getOSMDetails(item, mapContext.getMap().zoom, force);
                // DEV_LOG && console.log('result', result);
                if (result) {
                    const newProps = {};
                    Object.keys(result.tags).forEach((k) => {
                        const value = result.tags[k];
                        if (!k.startsWith('addr:') && ignoredKeys.indexOf(k) === -1 && value !== item.properties.class) {
                            newProps[k] = itemProperties[k] = value;
                        }
                    });
                    item = { ...item, properties: { ...itemProperties, osmid: result.id } };
                    extraProps = newProps;
                }
                if (needsSaving) {
                    saveItem(false);
                }
            }
            // if (!item.properties.opening_hours) {
            //     const result = await itemsModule.getFacebookDetails(item, mapContext.getMap().zoom);
            // }
            // } else {
            //     extraProps = {};
            // }

            refreshItems();
        } catch (error) {
            console.error(error, error.stack);
        } finally {
            loading = false;
        }
    }

    refresh();
    let collectionView: NativeViewElementNode<CollectionView>;

    function onTopDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            const w = canvas.getWidth();
            const h = canvas.getHeight();
            const iconsTop = 5;
            const iconsLeft = 34;
            topItemsToDraw.forEach((c, index) => {
                const x = index * 75 + iconsLeft;
                const paint = c.paint || textIconPaint;
                if (index > 0) {
                    const lineX = index * 70;
                    canvas.drawLine(lineX, 15, lineX, h - 15, borderPaint);
                }
                paint.setColor(c.color || colorOnSurface);
                if (c.icon) {
                    paint.setTextSize(c.iconFontSize || 24);
                    canvas.drawText(c.icon, x, iconsTop + 20, paint);
                }
                if (c.value) {
                    textIconPaint.setTextSize(12);
                    // textIconPaint.setFontWeight('bold');
                    // textIconPaint.setColor(c.color || colorOnSurface);
                    canvas.drawText(c.value + '', x, iconsTop + 20 + 19, textIconPaint);
                }
                if (c.subvalue) {
                    textIconPaint.setTextSize(9);
                    textIconPaint.setFontWeight('normal');
                    // textIconPaint.setColor(c.color || colorOnSurface);
                    canvas.drawText(c.subvalue + '', x, iconsTop + 20 + 30, textIconPaint);
                }
            });
            canvas.drawLine(0, 0, w - 0, 0, borderPaint);
            canvas.drawLine(0, h - 1, w - 0, h - 1, borderPaint);
        } catch (err) {
            console.error(err, err.stack);
        }
    }

    async function saveItem(peek = true) {
        DEV_LOG && console.log('saveItem', item);
        try {
            item = await itemsModule.saveItem(item);
            extraProps = {};
            refreshItems();
            if (item.route) {
                mapContext.mapModules.directionsPanel.cancel(false);
            }
            mapContext.selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
            if (item.route) {
                itemsModule.takeItemPicture(item);
            }
        } catch (err) {
            showError(err);
        }
    }
    async function onItemTap(event, listItem) {
        DEV_LOG && console.log('onItemTap', listItem);
        try {
            switch (listItem.id) {
                case 'website':
                    await openURL(listItem.subtitle);
                    break;
                case 'phone':
                    openUrl('tel:' + listItem.subtitle);
                    break;
                case 'email':
                    await compose({
                        to: [listItem.subtitle]
                    });
                    break;
                case 'wikipedia':
                    await openURL(`https://en.wikipedia.org/wiki/${listItem.subtitle}`);
                    break;
                case 'wikidata':
                    await openURL(`https://www.wikidata.org/wiki/${listItem.subtitle}`);
                    break;
                case 'mapillary':
                    await openURL(`https://www.mapillary.com/app/?pKey=${listItem.subtitle}&focus=photo`);
                    break;
                default:
                    if (listItem.expandable) {
                        expandItem(event, listItem);
                    } else {
                        share(
                            {
                                message: listItem.subtitle
                            },
                            {
                                dialogTitle: lc('share')
                            }
                        );
                    }
                    break;
            }
        } catch (err) {
            showError(err);
        }
    }

    function expandItem(event, listItem) {
        let collapseButton = event.object as View;
        if (collapseButton instanceof LayoutBase) {
            collapseButton = collapseButton.getViewById('rightButton');
        }
        DEV_LOG && console.log('expandItem', collapseButton, listItem.expanded);
        listItem.expanded = !listItem.expanded;
        collapseButton.animate({
            duration: 200,
            rotate: listItem.expanded ? 180 : 0
        });
        const index = items.indexOf(listItem);
        if (index >= 0) {
            items.setItem(index, listItem);
            // setTimeout(() => {
            // collectionView.nativeView.scrollToIndex(index +1, true);

            // }, 10);
        }
    }
    async function onItemRightTap(event, listItem) {
        // DEV_LOG && console.log('onItemRightTap', listItem);
        try {
            switch (listItem.id) {
                case 'network':
                case 'operator':
                case 'wikidata':
                    if (listItem.wikidata) {
                        await openURL(`https://www.wikidata.org/wiki/${listItem.wikidata}`);
                    }
                    break;
                case 'phone':
                    openUrl('sms:' + listItem.subtitle);
                    break;
                default:
                    if (listItem.expandable) {
                        expandItem(event, listItem);
                    }
                    break;
            }
        } catch (err) {
            showError(err);
        }
    }

    // function redraw(...args) {
    //     nString = null;
    //     canvas?.nativeView?.redraw();
    // }
</script>

<gesturerootview {height} rows="auto,auto,*" {...$$restProps} backgroundColor={colorBackground}>
    <gridlayout columns="auto,*,auto" rows={`${$actionBarHeight}`} {...$$restProps} color={colorOnSurface}>
        <!-- <label id="title" fontSize={40} text={itemIcon} fontFamily={itemIconFontFamily} verticalTextAlignment="center" /> -->
        <IconButton fontFamily="osm" text={osmicon(formatter.geItemIcon(item))} />
        <label id="title" autoFontSize={true} col={1} fontSize={18} fontWeight="bold" maxFontSize={18} text={formatter.getItemTitle(item) || ''} verticalTextAlignment="center" />
        <stacklayout col={2} orientation="horizontal">
            <IconButton isVisible={Object.keys(extraProps).length > 0} text="mdi-content-save-outline" on:tap={() => saveItem()} />
            <IconButton text="mdi-autorenew" on:tap={() => refresh(true)} />
            <activityindicator busy={loading} height={$actionBarButtonHeight} verticalAlignment="middle" visibility={loading ? 'visible' : 'collapse'} width={$actionBarButtonHeight} />
        </stacklayout>
    </gridlayout>
    <canvasview height={60} row={1} visibility={topItemsToDraw.length ? 'visible' : 'collapse'} on:draw={onTopDraw} />
    <collectionview bind:this={collectionView} itemTemplateSelector={(item) => item.type || 'default'} {items} row={2}>
        <Template key="json" let:item>
            <JsonViewer backgroundColor={colorBackground} jsonText={item.src} padding={10} />
        </Template>
        <Template let:item>
            <gridlayout on:tap={(e) => onItemTap(e, item)}>
                <ListItem2 height={item.expanded ? item.expandedHeight : item.height || 70} smallHeight={item.height || 70} {...item} />
                <IconButton
                    id="rightButton"
                    horizontalAlignment="right"
                    isVisible={!!item.rightIcon || !!item.expandable}
                    marginRight={10}
                    marginTop={15}
                    rotate={item.expanded ? 180 : 0}
                    size={40}
                    text={item.rightIcon || 'mdi-chevron-down'}
                    verticalAlignment="top"
                    on:tap={(e) => onItemRightTap(e, item)} />
            </gridlayout>
        </Template>
    </collectionview>
</gesturerootview>
