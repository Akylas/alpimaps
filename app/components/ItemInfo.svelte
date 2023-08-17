<script lang="ts">
    import { Align, Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Color, LayoutBase, ObservableArray, View } from '@nativescript/core';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { convertElevation, getAddress, openingHoursText, osmicon } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { showError } from '~/utils/error';
    import { openLink } from '~/utils/ui';
    import { actionBarHeight, backgroundColor, borderColor, mdiFontFamily, textColor } from '~/variables';
    import IconButton from './IconButton.svelte';
    import ListItem2 from './ListItem2.svelte';
    import { openUrl } from '@akylas/nativescript/utils';
    import { compose } from '@nativescript/email';

    export let item: Item;
    export let height: number | string = '100%';
    let extraProps = {};
    const borderPaint = new Paint();
    borderPaint.setColor($borderColor);
    // paint.setStyle(Style.STROKE)
    borderPaint.setStrokeWidth(2);
    const textIconPaint = new Paint();
    textIconPaint.setTextAlign(Align.CENTER);
    textIconPaint.fontFamily = mdiFontFamily;

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
    $: itemIcon = osmicon(formatter.geItemIcon(item));
    $: itemIconFontFamily = 'osm';

    let items: ObservableArray<any>;
    const propsToFilter = [
        'notes',
        'name',
        'address',
        'extent',
        'profile',
        'zoomBounds',
        'osm_value',
        'osm_key',
        'class',
        'layer',
        'rank',
        'provider',
        'categories',
        'route',
        'profile',
        'ele',
        'style',
        'id'
    ];
    function refreshItems() {
        // because of svelte async way itemIsRoute might not be set on opening
        const newItems = [];
        const itemProperties = item.properties;

        if (itemProperties.address) {
            const address = getAddress(item);
            newItems.push({
                id: 'address',
                title: lc('address'),
                subtitle: address.join(' '),
                leftIcon: 'mdi-map-marker'
            });
        }
        if (itemProperties['opening_hours']) {
            const data = openingHoursText(item);
            newItems.push({
                id: 'opening_hours',
                title: lc('opening_hours'),
                subtitle: data.text,
                subtitleColor: data.color,
                leftIcon: 'mdi-clock-outline',
                expandable: true,
                expandedHeight: 224,
                opening_hours: data.oh
            });
        }
        if (itemProperties.phone) {
            newItems.push({
                id: 'phone',
                title: lc('phone'),
                subtitle: itemProperties.phone,
                leftIcon: 'mdi-phone',
                rightIcon: 'mdi-message-text'
            });
        }
        if (itemProperties.email) {
            newItems.push({
                id: 'email',
                title: lc('email'),
                subtitle: itemProperties.email,
                leftIcon: 'mdi-email'
            });
        }
        if (itemProperties.website) {
            itemProperties.website.split(';').forEach((i) => {
                newItems.push({
                    id: 'website',
                    title: lc('website'),
                    subtitle: i,
                    leftIcon: 'mdi-web'
                });
            });
        }
        if (itemProperties.wikipedia) {
            newItems.push({
                id: 'wikipedia',
                title: lc('wikipedia'),
                subtitle: itemProperties.wikipedia,
                leftIcon: 'mdi-wikipedia'
            });
        }
        items = new ObservableArray(newItems);

        const toDraw = [];
        Object.keys(itemProperties).forEach((k) => {
            if (topProps.indexOf(k) !== -1) {
                switch (k) {
                    case 'population':
                        toDraw.push({
                            // paint: wiPaint,
                            // color: item.cloudColor,
                            // iconFontSize,
                            icon: 'mdi-account-group',
                            value: itemProperties[k],
                            subvalue: lc('population')
                        });
                        break;
                    case 'wheelchair':
                        toDraw.push({
                            // paint: wiPaint,
                            // color: item.cloudColor,
                            // iconFontSize,
                            icon: 'mdi-wheelchair',
                            value: lc('wheelchair')
                        });
                        break;
                    case 'ele':
                        if (item.properties.class === 'natural') {
                            toDraw.push({
                                // paint: wiPaint,
                                // color: item.cloudColor,
                                // iconFontSize,
                                icon: 'mdi-triangle-outline',
                                value: convertElevation(itemProperties[k]),
                                subvalue: lc('elevation')
                            });
                        }
                        break;
                    default:
                        toDraw.push({
                            // paint: wiPaint,
                            // color: item.cloudColor,
                            // iconFontSize,
                            icon: 'mdi-currency-eur',
                            value: lc(k),
                            subvalue: (itemProperties[k] + '').toLowerCase()
                        });
                        break;
                }
            }
        });
        topItemsToDraw = toDraw;
    }
    const itemsModule = getMapContext().mapModule('items');

    const topProps = ['population', 'wheelchair', 'atm', 'change_machine', 'copy_facility', 'stamping_machine', 'currency', 'ele'];
    const ignoredKeys = ['source', 'building', 'wall', 'bench', 'shelter_type', 'amenity', 'check_date', 'note', 'comment', 'ele', 'tourism'];

    let canRefresh = false;
    async function refresh() {
        try {
            const itemProperties = { ...item.properties };
            DEV_LOG && console.log('refresh', item);
            if (!itemProperties.osmid) {
                const result = await itemsModule.getOSMDetails(item, getMapContext().getMap().zoom);
                DEV_LOG && console.log('result', result);
                if (result) {
                    const newProps = {};
                    Object.keys(result.tags).forEach((k) => {
                        const value = result.tags[k];
                        if (k.indexOf(':') === -1 && ignoredKeys.indexOf(k) === -1 && value !== item.properties.class) {
                            newProps[k] = itemProperties[k] = value;
                        }
                    });
                    item = { ...item, properties: { ...itemProperties, osmid: result.id } };
                    extraProps = newProps;
                }
                // if (!item.properties.opening_hours) {
                //     const result = await itemsModule.getFacebookDetails(item, getMapContext().getMap().zoom);
                // }
                canRefresh = false;
            } else {
                extraProps = {};
                canRefresh = true;
            }

            refreshItems();
        } catch (error) {
            console.error(error, error.stack);
        }
    }

    refresh();
    let collectionView: NativeViewElementNode<CollectionView>;

    function onTopDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            let w = canvas.getWidth();
            let h = canvas.getHeight();
            const iconsTop = 10;
            const iconsLeft = 34;
            topItemsToDraw.forEach((c, index) => {
                let x = index * 75 + iconsLeft;
                const paint = c.paint || textIconPaint;
                if (index > 0) {
                    const lineX = index * 70;
                    canvas.drawLine(lineX, 15, lineX, h - 15, borderPaint);
                }
                paint.setColor(c.color || $textColor);
                if (c.icon) {
                    paint.setTextSize(c.iconFontSize || 24);
                    canvas.drawText(c.icon, x, iconsTop + 20, paint);
                }
                if (c.value) {
                    textIconPaint.setTextSize(12);
                    // textIconPaint.setFontWeight('bold');
                    // textIconPaint.setColor(c.color || $textColor);
                    canvas.drawText(c.value + '', x, iconsTop + 20 + 19, textIconPaint);
                }
                if (c.subvalue) {
                    textIconPaint.setTextSize(9);
                    textIconPaint.setFontWeight('normal');
                    // textIconPaint.setColor(c.color || $textColor);
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
            canRefresh = true;
            extraProps = {};
            refreshItems();
            if (item.route) {
                getMapContext().mapModules.directionsPanel.cancel(false);
            }
            getMapContext().selectItem({ item, isFeatureInteresting: true, peek, preventZoom: false });
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
                    await openLink(listItem.subtitle);
                    break;
                case 'phone':
                    openUrl('tel:' + listItem.subtitle);
                    break;
                case 'email':
                    await compose({
                        to:[listItem.subtitle]
                    })
                    break;
                case 'wikipedia':
                    const url = `https://en.wikipedia.org/wiki/${listItem.subtitle}`;
                    await openLink(url);
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
        }
    }
    async function onItemRightTap(event, listItem) {
        DEV_LOG && console.log('onItemRightTap', listItem);
        try {
            switch (listItem.id) {
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

<gridlayout {height} rows="auto,auto,*" {...$$restProps} backgroundColor={$backgroundColor}>
    <gridLayout columns="auto,*,auto" rows={`${actionBarHeight}`} {...$$restProps} color={$textColor}>
        <label id="title" col={1} fontSize={20} fontWeight="bold" textAlignment="left" text={formatter.getItemTitle(item) || ''} verticalTextAlignment="center" />
        <IconButton text={osmicon(formatter.geItemIcon(item))} color="white" fontFamily="osm" />
        <stackLayout col={2} orientation="horizontal">
            <IconButton text="mdi-content-save-outline" color="white" isVisible={Object.keys(extraProps).length > 0} on:tap={() => saveItem()} />
            <IconButton text="mdi-autorenew" color="white" isVisible={canRefresh} />
        </stackLayout>
    </gridLayout>
    <canvas row={1} visibility={topItemsToDraw.length ? 'visible' : 'collapsed'} on:draw={onTopDraw} height={60} />
    <collectionview row={2} {items} bind:this={collectionView}>
        <Template let:item>
            <gridlayout on:tap={(e) => onItemTap(e, item)}>
                <ListItem2 height={item.expanded ? item.expandedHeight : 70} {...item} />
                <IconButton
                    id="rightButton"
                    text={item.rightIcon || 'mdi-chevron-down'}
                    marginRight={10}
                    marginTop={15}
                    size={40}
                    horizontalAlignment="right"
                    verticalAlignment="top"
                    rotate={item.expanded ? 180 : 0}
                    isVisible={!!item.rightIcon || !!item.expandable}
                    on:tap={(e) => onItemRightTap(e, item)}
                />
            </gridlayout>
        </Template>
    </collectionview>
</gridlayout>
