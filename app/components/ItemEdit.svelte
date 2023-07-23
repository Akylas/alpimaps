<script lang="ts">
    import { MapBounds } from '@nativescript-community/ui-carto/core';
    import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
    import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
    import { CartoMap, PanningMode } from '@nativescript-community/ui-carto/ui';
    import { Color, Utils, View } from '@nativescript/core';
    import type { Point as GeoJSONPoint, Point } from 'geojson';
    import { goBack, showModal } from 'svelte-native/dom';
    import { osmicon } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { showError } from '~/utils/error';
    import { pickColor } from '~/utils/utils';
    import { lightBackgroundColor, mdiFontFamily, navigationBarHeight, subtitleColor, textLightColor } from '~/variables';
    import CActionBar from './CActionBar.svelte';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { showPopover } from '@nativescript-community/ui-popover/svelte';

    export let item: Item;
    let itemColor: Color;
    let itemIsRoute = false;
    let itemUsingDefault = false;
    let itemIcon: string = null;
    let itemIconFontFamily: string = null;
    let itemUsingMdi = false;
    let osmIcon = null;
    $: itemIsRoute = !!item?.route;
    $: itemColor = updatedProperties['color'] || item.properties['color'] || (itemIsRoute ? '#287bda' : '#60A5F4');
    $: itemIcon = updatedProperties['icon'] || item.properties['icon'];
    $: osmIcon = osmicon(formatter.geItemIcon(item));
    $: itemIconFontFamily = updatedProperties['fontFamily'] || item.properties['fontFamily'];
    $: itemUsingMdi = itemIconFontFamily === mdiFontFamily;
    $: itemUsingDefault = itemUsingMdi && itemIcon === 'mdi-map-marker';
    $: itemUsingOsm = itemIcon === osmIcon && itemIconFontFamily === 'osm';
    let updatedProperties = {};
    const mapContext = getMapContext();
    function blurTextField() {
        Utils.dismissSoftInput();
    }
    let updatingItem = false;
    async function updateItem() {
        try {
            updatingItem = true;
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
    function onTextChange(property, e) {
        updatedProperties[property] = e['value'];
        updatePreview();
    }
    let cartoMap: CartoMap<LatLonKeys>;
    let vectorTileDataSource: GeoJSONVectorTileDataSource;
    let vectorTileLayer: VectorTileLayer;

    function updatePreview() {
        updatedProperties = updatedProperties;
        const str = JSON.stringify({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', id: item.id, properties: Object.assign({}, item.properties, updatedProperties), geometry: item.geometry }]
        });
        // DEV_LOG && console.log('updateGeoJSONLayer', str);
        vectorTileDataSource.setLayerGeoJSONString(1, str);
    }
    async function onMapReady(e) {
        cartoMap = e.object as CartoMap<LatLonKeys>;
        // projection = cartoMap.projection;
        // if (__ANDROID__) {
        //     console.log('onMapReady', com.carto.ui.BaseMapView.getSDKVersion());
        // } else {
        //     console.log('onMapReady', cartoMap.nativeViewProtected as NTMapView);
        // }

        const options = cartoMap.getOptions();
        options.setWatermarkScale(0);
        options.setRestrictedPanning(true);
        options.setPanningMode(PanningMode.PANNING_MODE_STICKY_FINAL);

        options.setZoomGestures(true);
        options.setKineticRotation(false);
        // const route = dataItems.map(i=>([]))
        try {
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            layers.forEach((l) => {
                var prototype = Object.getPrototypeOf(l.layer);
                cartoMap.addLayer(new prototype.constructor(l.layer.options));
            });

            vectorTileDataSource = new GeoJSONVectorTileDataSource({
                simplifyTolerance: 2,
                minZoom: 0,
                maxZoom: 24
            });
            vectorTileDataSource.createLayer('items');
            updatePreview();
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
                        extent = `[${extent}]` as any;
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
    async function pickOptionColor(color: Color) {
        try {
            const newColor = await pickColor(color, { alpha: false });
            if (!newColor) {
                return;
            }
            updatedProperties['color'] = newColor.hex;
            updatePreview();
        } catch (err) {
            showError(err);
        }
    }
    function setOSMIcon() {
        updatedProperties['fontFamily'] = 'osm';
        updatedProperties['mapFontFamily'] = 'osm';
        updatedProperties['iconDx'] = 0;
        updatedProperties['icon'] = osmIcon;
        updatePreview();
    }
    function setDefaultIcon() {
        updatedProperties['fontFamily'] = mdiFontFamily;
        updatedProperties['mapFontFamily'] = MATERIAL_MAP_FONT_FAMILY;
        updatedProperties['iconDx'] = -2;
        updatedProperties['icon'] = 'mdi-map-marker';
        updatePreview();
    }

    async function selectCustomIcon() {
        try {
            const IconChooser = (await import('~/components/IconChooser.svelte')).default as any;
            const results = await showModal({
                fullscreen: true,
                page: IconChooser as any
            });
            const result = Array.isArray(results) ? results[0] : results;
            if (result) {
                console.log('result', result);
                updatedProperties['fontFamily'] = result.fontFamily;
                itemUsingMdi = result.fontFamily === mdiFontFamily;
                updatedProperties['mapFontFamily'] = itemUsingMdi ? MATERIAL_MAP_FONT_FAMILY : 'osm';
                updatedProperties['iconDx'] = itemUsingMdi ? -2 : 0;
                updatedProperties['icon'] = result.icon;
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

    async function featchAddress(event) {
        try {
            const SearchModal = (await import('~/components/SearchModal.svelte')).default as any;
            const geometry = item.geometry as Point;
            const position = { lat: geometry.coordinates[1], lon: geometry.coordinates[0], altitude: geometry.coordinates[2] };
            console.log('position', position)
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
                    width: Utils.layout.toDeviceIndependentPixels(anchorView.getMeasuredWidth()),
                    position
                }
            });
            if (result) {
                console.log(result);
            }
        } catch (error) {
            showError(error);
        }
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*,3*,auto" android:paddingBottom={$navigationBarHeight}>
        <CActionBar canGoBack title={lc('edit')} />
        <cartomap row={1} zoom={16} on:mapReady={onMapReady} useTextureView={false} on:layoutChanged={onLayoutChanged} />
        <canvaslabel row={1} fontSize={16} height={50} width={50} on:tap={pickOptionColor(itemColor)} horizontalAlignment="right" verticalAlignment="bottom">
            <circle strokeWidth={2} paintStyle="fill" fillColor={$textLightColor} radius={15} antiAlias={true} horizontalAlignment="right" verticalAlignment="middle" width={20} />
            <circle
                strokeWidth={2}
                paintStyle="fill_and_stroke"
                strokeColor={$textLightColor}
                fillColor={itemColor}
                radius={15}
                antiAlias={true}
                horizontalAlignment="right"
                verticalAlignment="middle"
                width={20}
            />
        </canvaslabel>
        {#if !itemIsRoute}
            <gridlayout row={1} columns="auto,auto,auto" height={50} horizontalAlignment="left" verticalAlignment="bottom" margin={5}>
                <label
                    visibility={itemUsingDefault ? 'collapse' : 'visible'}
                    on:tap={setDefaultIcon}
                    fontSize={22}
                    borderRadius={4}
                    backgroundColor={$lightBackgroundColor}
                    col={0}
                    verticalAlignment="middle"
                    textAlignment="center"
                    padding={5}
                    width={50}
                    height={50}
                    elevation={2}
                    margin="0 4 0 4"
                    borderColor={$subtitleColor}
                    borderWidth={1}
                    rippleColor={itemColor}
                >
                    <span text="mdi-map-marker" fontFamily={mdiFontFamily} color={itemColor} />
                    <span fontSize={12} text={'\n' + lc('marker')} />
                </label>
                <label
                    visibility={itemUsingOsm ? 'collapse' : 'visible'}
                    fontSize={20}
                    on:tap={setOSMIcon}
                    borderRadius={4}
                    backgroundColor={$lightBackgroundColor}
                    col={1}
                    verticalAlignment="middle"
                    textAlignment="center"
                    padding={5}
                    width={50}
                    height={50}
                    elevation={2}
                    margin="0 4 0 4"
                    borderColor={$subtitleColor}
                    borderWidth={1}
                    rippleColor={itemColor}
                >
                    <span text={osmIcon} fontFamily="osm" color={itemColor} />
                    <span fontSize={12} text={'\n' + lc('osm')} />
                </label>
                <label
                    on:tap={selectCustomIcon}
                    fontSize={itemUsingMdi ? 22 : 18}
                    borderRadius={4}
                    backgroundColor={$lightBackgroundColor}
                    col={2}
                    verticalAlignment="middle"
                    textAlignment="center"
                    padding={5}
                    width={50}
                    height={50}
                    margin="0 4 0 4"
                    borderColor={$subtitleColor}
                    borderWidth={1}
                    elevation={2}
                    rippleColor={itemColor}
                >
                    <span text={itemIcon} fontFamily={itemIconFontFamily} color={itemColor} />
                    <span fontSize={12} text={'\n' + lc('custom')} />
                </label>
            </gridlayout>
        {/if}
        <flexlayout row={2} padding="0 10 0 10" flexDirection="column">
            <textfield
                variant="outline"
                margin="10 0 0 0"
                hint={lc('name')}
                placeholder={lc('name')}
                returnKeyType="done"
                on:return={blurTextField}
                text={formatter.getItemTitle(item)}
                on:textChange={(e) => onTextChange('name', e)}
            />

            <textfield
                visibility={itemIsRoute ? 'collapsed' : 'visible'}
                variant="outline"
                margin="10 0 0 0"
                hint={lc('address')}
                editable={false}
                placeholder={lc('address')}
                text={formatter.getItemAddress(item)}
                on:tap={featchAddress}
            />

            <textview
                flexGrow={1}
                variant="outline"
                margin="10 0 0 0"
                hint={lc('notes')}
                placeholder={lc('notes')}
                returnKeyType="done"
                on:return={blurTextField}
                text={item.properties['notes']}
                on:textChange={(e) => onTextChange('notes', e)}
            />
        </flexlayout>
        <mdbutton row={3} on:tap={(e) => updateItem()} text={lc('save')} marginBottom={20} />
    </gridlayout>
</page>
