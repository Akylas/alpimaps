<script lang="ts">
    import { MapBounds } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap, PanningMode } from '@nativescript-community/ui-carto/ui';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';
    import { Color, File, ObservableArray, Utils, View } from '@nativescript/core';
    import type { Point as GeoJSONPoint, Point } from 'geojson';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoLocation } from '~/handlers/GeoHandler';
    import { osmicon } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { showError } from '@shared/utils/showError';
    import { goBack } from '@shared/utils/svelte/ui';
    import { pickColor } from '~/utils/utils';
    import { colors, fonts, windowInset } from '~/variables';
    import CActionBar from '~/components/common/CActionBar.svelte';
    import IconButton from '~/components/common/IconButton.svelte';
    import TagView from '~/components/common/TagView.svelte';

    $: ({ colorBackground, colorOnPrimary, colorOnSurfaceVariant, colorPrimary, colorSurfaceContainerHigh } = $colors);
    export let item: Item;
    let itemColor: string;
    let itemIsRoute = false;
    let itemUsingDefault = false;
    let itemIcon: string = null;
    let itemIconFontFamily: string = null;
    let itemUsingMdi = false;
    let osmIcon = null;

    function getStyleProperty(properties, k: string) {
        return properties['style']?.[k];
    }

    $: itemIsRoute = !!item?.route;
    $: itemColor = getStyleProperty(updatedProperties, 'color') || getStyleProperty(item.properties, 'color') || (itemIsRoute ? new Color($colors.colorPrimary).darken(10).hex : colorPrimary);
    $: itemIcon = getStyleProperty(updatedProperties, 'icon') || getStyleProperty(item.properties, 'icon');
    $: osmIcon = osmicon(formatter.geItemIcon(item));
    $: itemIconFontFamily = getStyleProperty(updatedProperties, 'fontFamily') || getStyleProperty(item.properties, 'fontFamily');
    $: itemUsingMdi = itemIconFontFamily === $fonts.mdi;
    $: itemUsingDefault = itemUsingMdi && itemIcon === 'mdi-map-marker';
    $: itemUsingOsm = itemIcon === osmIcon && itemIconFontFamily === 'osm';
    let updatedProperties = {};
    let canSave = false;
    $: canSave = Object.keys(updatedProperties).length > 0;
    $: DEV_LOG && console.log('itemColor', itemColor);
    const mapContext = getMapContext();
    function blurTextField(event) {
        Utils.dismissSoftInput(event?.object.nativeViewProtected);
    }
    let updatingItem = false;

    async function updateItem() {
        try {
            if (!canSave) {
                return;
            }
            updatingItem = true;
            // console.log('updateItem', updatedProperties);
            const savedItem = await mapContext.mapModule('items').updateItem(item, { properties: { ...item.properties, ...updatedProperties } });
            if (mapContext.getSelectedItem()?.id === item.id) {
                mapContext.setSelectedItem(savedItem);
            }
            goBack();
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    function onItemTextChange(item, e) {
        if (item.id === 'address' || (!updatedProperties[item.id] && e.value === '')) {
            return;
        }
        updatedProperties[item.id] = item.value = e.value;
        updatePreview(false);
    }

    let cartoMap: CartoMap<LatLonKeys>;
    let vectorTileDataSource: GeoJSONVectorTileDataSource;
    let vectorTileLayer: VectorTileLayer;

    function updatePreview(updateForSvelte = true) {
        if (updateForSvelte) {
            updatedProperties = updatedProperties;
        }
        if (vectorTileDataSource) {
            // DEV_LOG && console.log('updateGeoJSONLayer', str);
            vectorTileDataSource.setLayerGeoJSONString(1, {
                type: 'FeatureCollection',
                features: [{ type: 'Feature', id: item.id, properties: Object.assign({}, item.properties, updatedProperties), geometry: item.geometry }]
            });
        }
    }
    async function onMapReady(e) {
        cartoMap = e.object as CartoMap<LatLonKeys>;
        // projection = cartoMap.projection;
        // if (__ANDROID__) {
        //     console.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        // } else {
        //     console.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        // }

        mapContext.setMapDefaultOptions(cartoMap.getOptions());
        // const route = dataItems.map(i=>([]))
        try {
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            layers.forEach((l) => {
                const prototype = Object.getPrototypeOf(l.layer);
                cartoMap.addLayer(new prototype.constructor(l.layer.options));
            });

            vectorTileDataSource = new GeoJSONVectorTileDataSource({
                simplifyTolerance: 2,
                minZoom: 0,
                maxZoom: 24
            });
            vectorTileDataSource.createLayer('items');
            updatePreview(false);
            vectorTileLayer = new VectorTileLayer({
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: VectorTileRenderOrder.LAST,
                clickRadius: 6,
                dataSource: vectorTileDataSource,
                decoder: getMapContext().innerDecoder
            });
            vectorTileLayer.setVectorTileEventListener(this);
            cartoMap.addLayer(vectorTileLayer);

            if (cartoMap.getMeasuredWidth()) {
                onLayoutChanged();
            }
        } catch (err) {
            showError(err);
        }
    }
    function onLayoutChanged() {
        if (!cartoMap) {
            return;
        }

        if (itemIsRoute) {
            if (item.image_path && (!item.image_path || !File.exists(item.image_path))) {
                const module = mapContext.mapModules['items'];
                item.image_path = module.getItemImagePath();
                module.takeItemPicture(item, true);
            }
            // TODO: update image if there is none (testing file existence?)
            const margin = Utils.layout.toDevicePixels(20);
            const screenBounds = {
                min: { x: margin, y: margin },
                max: { x: cartoMap.getMeasuredWidth() - margin, y: cartoMap.getMeasuredHeight() - margin }
            };
            if (item.properties?.zoomBounds) {
                cartoMap.moveToFitBounds(item.properties.zoomBounds, screenBounds, false, true, false, 0);
            } else if (item.properties?.extent) {
                let extent: [number, number, number, number] = item.properties.extent as any;
                if (typeof extent === 'string') {
                    if (extent[0] !== '[') {
                        extent = `[${extent as string}]` as any;
                    }
                    extent = JSON.parse(extent as any);
                }
                cartoMap.moveToFitBounds(new MapBounds({ lat: extent[1], lon: extent[0] }, { lat: extent[3], lon: extent[2] }), screenBounds, true, true, false, 0);
            }
        } else {
            cartoMap.setZoom(14, 0);
            const geometry = item.geometry as GeoJSONPoint;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
            cartoMap.setFocusPos(position, 0);
        }
    }

    function getUpdateStyle() {
        return (updatedProperties['style'] = updatedProperties['style'] || item.properties.style || {});
    }
    async function pickOptionColor(color: Color | string) {
        try {
            const newColor = await pickColor(color, { alpha: false });
            if (!newColor) {
                return;
            }
            const style = getUpdateStyle();
            DEV_LOG && console.log('pickOptionColor', updatedProperties);
            style['color'] = newColor.hex;
            updatePreview();
        } catch (err) {
            showError(err);
        }
    }

    function setOSMIcon() {
        const style = getUpdateStyle();
        style['fontFamily'] = 'osm';
        style['mapFontFamily'] = 'osm';
        style['iconDx'] = 0;
        style['icon'] = osmIcon;
        console.log('setOSMIcon', updatedProperties);
        updatePreview();
    }
    function setDefaultIcon() {
        const style = getUpdateStyle();
        console.log('setDefaultIcon', updatedProperties);
        style['fontFamily'] = $fonts.mdi;
        style['mapFontFamily'] = MATERIAL_MAP_FONT_FAMILY;
        style['iconDx'] = -2;
        style['icon'] = 'mdi-map-marker';
        updatePreview();
    }

    async function selectCustomIcon(event) {
        try {
            const IconChooser = (await import('~/components/items/IconChooser.svelte')).default;
            const results = await showPopover({
                // fullscreen: true,
                // trackingScrollView: 'collectionView',
                view: IconChooser,
                vertPos: VerticalPosition.ALIGN_TOP,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                anchor: event.object,
                props: {
                    elevation: 4,
                    margin: 10
                }
                // peekHeight: 400
            });
            const result = Array.isArray(results) ? results[0] : results;
            if (result) {
                console.log('result', result, updatedProperties);
                const style = getUpdateStyle();
                style['fontFamily'] = result.fontFamily;
                itemUsingMdi = result.fontFamily === $fonts.mdi;
                style['mapFontFamily'] = itemUsingMdi ? MATERIAL_MAP_FONT_FAMILY : 'osm';
                style['iconDx'] = itemUsingMdi ? -2 : 0;
                style['icon'] = result.icon;
                updatePreview();
                // const provider = result.data;
                // if (result.isPick) {
                //     provider.name = File.fromPath(provider.url).name;
                //     provider.id = provider.url;
                //     provider.type = 'orux';
                // }
                // const data = await this.createRasterLayer(provider.id || result.name, provider);
                // this.addDataSource(data);
            }
        } catch (error) {
            showError(error);
        }
    }

    async function featchAddress(listItem, event) {
        try {
            const SearchModal = (await import('~/components/search/SearchModal.svelte')).default;
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] } as GeoLocation;
            // const result: any = await showModal({ page: Settings, fullscreen: true, props: { position } });
            const anchorView = event.object as View;
            const result: any = await showPopover({
                vertPos: VerticalPosition.ALIGN_TOP,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                view: SearchModal,
                anchor: anchorView,
                props: {
                    height: 56,
                    elevation: 4,
                    margin: 10,
                    query: event.object.text,
                    width: Utils.layout.toDeviceIndependentPixels(anchorView.getMeasuredWidth()),
                    position
                }
            });
            if (result) {
                updatedProperties['address'] = result.properties.address;
                listItem.value = formatter.getItemAddress({ properties: { ...item.properties, ...updatedProperties } });
                const index = items.indexOf(listItem);
                if (index >= 0) {
                    items.splice(index, 1, listItem);
                }
            }
        } catch (error) {
            showError(error);
        }
    }
    let items: ObservableArray<any>;
    const propsToFilter = [
        'hasRealName',
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
        itemIsRoute = !!item.route;
        const props = { ...item.properties, ...updatedProperties };
        const propsKeys = Object.keys(props).filter((s) => propsToFilter.indexOf(s) === -1);
        const { profile, route, ...toPrint } = props;
        items = new ObservableArray(
            (
                [
                    { type: 'taggroup', groups: item.groups },
                    { name: lc('name'), id: 'name', value: formatter.getItemTitle({ ...item, properties: { ...item.properties, ...updatedProperties } }) }
                ] as any[]
            )
                .concat(
                    itemIsRoute
                        ? []
                        : [
                              {
                                  editable: false,
                                  onTap: featchAddress,
                                  name: lc('address'),
                                  id: 'address',
                                  value: updatedProperties['address'] ? formatter.getItemAddress({ properties: updatedProperties }) : formatter.getItemAddress(item)
                              }
                          ]
                )
                .concat(
                    propsKeys.map((k) => ({
                        name: lc(k),
                        id: k,
                        value: props[k]
                    }))
                )
                .concat([{ type: 'textview', name: lc('notes'), id: 'notes', value: updatedProperties['notes'] || item.properties['notes'] }])
        );
    }
    refreshItems();
    let collectionView: NativeViewElementNode<CollectionView>;

    async function addField() {}
    async function onTagViewSelectedGroup(event) {
        const groupName = event.group;
        // console.log('onTagViewSelectedGroup', groupName);
        try {
            updatingItem = true;
            await mapContext.mapModule('items').setItemGroup(item, groupName);
            item = item;
            items.setItem(0, { ...items.getItem(0), groups: item.groups });
        } catch (err) {
            showError(err);
        } finally {
            updatingItem = false;
        }
    }

    async function fetchOSMDetails() {
        try {
            const ignoredKeys = mapContext.mapModule('items').ignoredOSMKeys;
            const result = await mapContext.mapModule('items').getOSMDetails(item, getMapContext().getMap().zoom);
            DEV_LOG && console.log('fetchOSMDetails', result);
            if (result) {
                const itemProperties = item.properties;
                const toAdd = { ...result.tags, osmid: result.id };
                Object.keys(toAdd).forEach((k) => {
                    const value = toAdd[k];
                    console.log('test new prop', k, value);
                    if (k.indexOf(':') === -1 && ignoredKeys.indexOf(k) === -1 && value !== item.properties.class) {
                        updatedProperties[k] = value;
                        if (!itemProperties[k] && propsToFilter.indexOf(k) === -1) {
                            console.log('adding new prop', k, value);
                            //new prop
                            items.splice(items.length - 2, 0, { name: lc(k), id: k, value });
                        }
                    }
                });
                // item = { ...item, properties: { ...itemProperties, osmid: result.id } };
                updatePreview(false);
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*,auto,2.5*,auto" android:paddingBottom={$windowInset.bottom} paddingLeft={$windowInset.left} paddingRight={$windowInset.right}>
        <CActionBar canGoBack title={lc('edit')}>
            <IconButton color={colorOnPrimary} isEnabled={canSave} text="mdi-content-save-outline" on:tap={(e) => updateItem()} />
            <IconButton color={colorOnPrimary} text="mdi-playlist-plus" on:tap={addField} />
            <IconButton color={colorOnPrimary} isVisible={!itemIsRoute} text="mdi-web-sync" on:tap={fetchOSMDetails} />
        </CActionBar>
        <cartomap row={1} zoom={16} on:mapReady={onMapReady} on:layoutChanged={onLayoutChanged} />
        <canvaslabel fontSize={16} height={50} horizontalAlignment="right" row={1} verticalAlignment="bottom" width={50} on:tap={() => pickOptionColor(itemColor)}>
            <circle antiAlias={true} fillColor={colorOnSurfaceVariant} horizontalAlignment="right" paintStyle="fill" radius={15} strokeWidth={2} verticalAlignment="middle" width={20} />
            <circle
                antiAlias={true}
                fillColor={itemColor}
                horizontalAlignment="right"
                paintStyle="fill_and_stroke"
                radius={15}
                strokeColor={colorOnSurfaceVariant}
                strokeWidth={2}
                verticalAlignment="middle"
                width={20} />
        </canvaslabel>
        {#if !itemIsRoute}
            <gridlayout columns="auto,auto,auto" height={50} horizontalAlignment="left" margin={5} row={1} verticalAlignment="bottom">
                <label
                    backgroundColor={colorBackground}
                    borderColor={colorOnSurfaceVariant}
                    borderRadius={4}
                    borderWidth={1}
                    elevation={2}
                    fontSize={22}
                    height={50}
                    margin="0 4 0 4"
                    padding={5}
                    rippleColor={itemColor}
                    textAlignment="center"
                    verticalAlignment="middle"
                    visibility={itemUsingDefault ? 'collapse' : 'visible'}
                    width={50}
                    on:tap={setDefaultIcon}>
                    <cspan color={itemColor} fontFamily={$fonts.mdi} text="mdi-map-marker" />
                    <cspan fontSize={12} text={'\n' + lc('marker')} />
                </label>
                <label
                    backgroundColor={colorBackground}
                    borderColor={colorOnSurfaceVariant}
                    borderRadius={4}
                    borderWidth={1}
                    col={1}
                    elevation={2}
                    fontSize={20}
                    height={50}
                    margin="0 4 0 4"
                    padding={5}
                    rippleColor={itemColor}
                    textAlignment="center"
                    verticalAlignment="middle"
                    visibility={itemUsingOsm ? 'collapse' : 'visible'}
                    width={50}
                    on:tap={setOSMIcon}>
                    <cspan color={itemColor} fontFamily="osm" text={osmIcon} />
                    <cspan fontSize={12} text={'\n' + lc('osm')} />
                </label>
                <label
                    backgroundColor={colorBackground}
                    borderColor={colorOnSurfaceVariant}
                    borderRadius={4}
                    borderWidth={1}
                    col={2}
                    elevation={2}
                    fontSize={itemUsingMdi ? 22 : 18}
                    height={50}
                    margin="0 4 0 4"
                    padding={5}
                    rippleColor={itemColor}
                    textAlignment="center"
                    verticalAlignment="middle"
                    width={50}
                    on:tap={selectCustomIcon}>
                    <cspan color={itemColor} fontFamily={itemIconFontFamily} text={itemIcon} />
                    <cspan fontSize={12} text={'\n' + lc('custom')} />
                </label>
            </gridlayout>
        {/if}
        <collectionview bind:this={collectionView} itemTemplateSelector={(item) => item.type || 'textfield'} {items} row={3} android:paddingBottom={$windowInset.bottom}>
            <Template key="taggroup" let:item>
                <TagView padding="5 10 0 10" showDefaultGroups={false} topGroup={item.groups?.[0]} on:groupSelected={onTagViewSelectedGroup} />
            </Template>
            <Template key="textfield" let:item>
                <gridlayout padding="10 10 0 10">
                    <textfield
                        editable={item.editable ?? true}
                        hint={item.name}
                        placeholder={item.name}
                        returnKeyType="done"
                        text={item.value}
                        variant="outline"
                        on:returnPress={blurTextField}
                        on:textChange={(e) => onItemTextChange(item, e)}
                        on:tap={(e) => item.onTap?.(item, e)} />
                </gridlayout>
            </Template>
            <Template key="textview" let:item>
                <gridlayout padding="10 10 0 10">
                    <textview
                        height={item.height || 150}
                        hint={item.name}
                        placeholder={item.name}
                        returnKeyType="done"
                        text={item.value}
                        variant="outline"
                        on:returnPress={blurTextField}
                        on:textChange={(e) => onItemTextChange(item, e)} />
                </gridlayout>
            </Template>
        </collectionview>
        <!-- <scrollview row={2}>
            <stacklayout>
                <textfield
                    variant="outline"
                    margin="10 0 0 0"
                    hint={lc('name')}
                    placeholder={lc('name')}
                    returnKeyType="done"
                    on:returnPress={blurTextField}
                    text={formatter.getItemTitle({ ...item, properties: { ...item.properties, ...updatedProperties } })}
                    on:textChange={(e) => onTextChange('name', e)}
                />
                <textfield
                    visibility={itemIsRoute ? 'collapse' : 'visible'}
                    variant="outline"
                    margin="10 0 0 0"
                    hint={lc('address')}
                    editable={false}
                    placeholder={lc('address')}
                    text={updatedProperties['address'] ? formatter.getItemAddress({ properties: updatedProperties }) : formatter.getItemAddress(item)}
                    on:tap={featchAddress}
                />

                <textview
                    height={150}
                    variant="outline"
                    margin="10 0 0 0"
                    hint={lc('notes')}
                    placeholder={lc('notes')}
                    returnKeyType="done"
                    on:returnPress={blurTextField}
                    text={item.properties['notes']}
                    on:textChange={(e) => onTextChange('notes', e)}
                />
            </stacklayout>
        </scrollview> -->

        <gridlayout columns="*,*" marginBottom={5} row={4}>
            <mdbutton isEnabled={canSave} text={lc('save')} verticalAlignment="center" on:tap={(e) => updateItem()} />
            <mdbutton
                col={1}
                text={lc('cancel')}
                variant="text"
                verticalAlignment="center"
                on:tap={(e) => {
                    updatedProperties = {};
                    refreshItems();
                    updatePreview(false);
                }} />
        </gridlayout>
    </gridlayout>
</page>
