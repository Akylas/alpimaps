<script lang="ts" context="module">
    import { GridLayout } from '@akylas/nativescript';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { setNumber } from '@nativescript/core/application-settings';
    import { ObservableArray } from '@nativescript/core/data/observable-array';
    import { onDestroy } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { primaryColor } from '~/variables';
    import { showBottomSheet } from './bottomsheet';
    import LayerOptionsBottomSheet from './LayerOptionsBottomSheet.svelte';
    import mapStore from '~/stores/mapStore';
</script>

<script lang="ts">
    const mapContext = getMapContext();
    let gridLayout: NativeViewElementNode<GridLayout>;

    export let customLayers: CustomLayersModule = null;
    export let customSources: ObservableArray<SourceItem> = [] as any;
    let currentLegend: string = null;
    mapContext.onMapReady((view: CartoMap<LatLonKeys>) => {
        customLayers = mapContext.mapModule('customLayers');
        customSources = customLayers.customSources;
    });
    onDestroy(() => {
        customLayers = null;
        customSources = null;
    });

    const packageServiceEnabled = gVars.packageServiceEnabled;

    function addSource() {
        customLayers.addSource();
    }
    function clearCache() {
        clearCache();
    }
    function selectLocalMbtilesFolder() {
        customLayers.selectLocalMbtilesFolder();
    }
    // get customSources() {
    //     console.log('get customSources', !!mapComp);
    //     if (mapComp) {
    //         return customLayers.customSources;
    //     }
    //     return [];
    // }

    // get mapComp() {
    //     console.log('get mapComp1', !!mMapComp);
    //     if (!mMapComp) {
    //         mMapComp = $getMapComponent();
    //         console.log('get mapComp', mMapComp);
    //     }
    //     return mMapComp;
    // }

    function onLayerOpacityChanged(item, event) {
        const opacity = event.value / 100;
        // console.log('onLayerOpacityChanged', item.name, event.value, opacity);
        item.layer.opacity = opacity;
        setNumber(item.name + '_opacity', opacity);
        item.layer.visible = opacity !== 0;
        mapContext.getMap().requestRedraw();
        // item.layer.refresh();
    }

    function showSourceOptions(item: SourceItem) {
        showBottomSheet({
            parent: gridLayout,
            view: LayerOptionsBottomSheet,
            props: {
                item
            }
        });
    }
</script>

<gridlayout {...$$restProps}  bind:this={gridLayout} columns="*,auto" width="100%" verticalAlignment="bottom" backgroundColor="#99000000">
    <collectionview col="0" rowHeight="70" items={customSources}>
        <Template let:item>
            <gridlayout paddingLeft="15" paddingRight="5" rows="*,auto" columns="*,auto" on:longPress={showSourceOptions(item)}>
                <label
                    row="0"
                    text={item.name.toUpperCase()}
                    color={item.layer.opacity === 0 ? 'grey' : 'white'}
                    fontSize="13"
                    fontWeight="bold"
                    verticalAlignment="bottom" />
                <mdslider
                    row="1"
                    marginLeft="10"
                    marginRight="10"
                    value={Math.round(item.layer.opacity * 100)}
                    on:valueChange={(event) => onLayerOpacityChanged(item, event)}
                    minValue="0"
                    maxValue="100"
                    verticalAlignment="center" />
                <mdbutton
                    col="1"
                    rowSpan="2"
                    color="white"
                    rippleColor="white"
                    variant="text"
                    class="icon-btn"
                    text="mdi-dots-vertical"
                    on:tap={showSourceOptions(item)} />
            </gridlayout>
        </Template>
    </collectionview>
    <stacklayout col="1" borderLeftColor="rgba(255,255,255,0.4)" borderLeftWidth="1">
        <mdbutton variant="text" class="icon-btn" text="mdi-plus" on:tap={addSource} />
        <mdbutton variant="text" class="icon-btn" text="mdi-layers-off" on:tap={clearCache} />
        <!-- <MDButton class="buttonthemed" @tap="addSource" text={l('add_source')} /> -->
        <!-- <MDButton class="buttonthemed" @tap="clearCache" text={l('clear_cache')} /> -->
        <!-- <MDButton class="buttonthemed" @tap="selectLocalMbtilesFolder" text={l('select_local_folder')} /> -->
        <mdbutton
            variant="text"
            class="icon-btn"
            text="mdi-domain"
            color={$mapStore.show3DBuildings ? primaryColor : 'gray'}
            on:tap={() => mapStore.setShow3DBuildings(!$mapStore.show3DBuildings)} />

        <mdbutton
            variant="text"
            class="icon-btn"
            text="mdi-signal"
            color={$mapStore.showContourLines ? primaryColor : 'gray'}
            on:tap={() => mapStore.setShowContourLines(!$mapStore.showContourLines)} />
        <mdbutton
            variant="text"
            class="icon-btn"
            text="mdi-globe-model"
            color={$mapStore.showGlobe ? primaryColor : 'gray'}
            on:tap={() => mapStore.setShowGlobe(!$mapStore.showGlobe)} />

        <mdbutton
            variant="text"
            class="icon-btn"
            text="mdi-map-clock"
            visibility={packageServiceEnabled ? 'visible' : 'collapsed'}
            color={$mapStore.preloading ? primaryColor : 'gray'}
            on:tap={() => mapStore.setPreloading(!$mapStore.preloading)} />
    </stacklayout>

    <!-- <GridLayout visibility="(currentLegend)?'visible':'collapsed'" rows="auto,*" columns="auto,*" backgroundColor={white}>
                <WebView rowSpan="2" colSpan="2" v-if="currentLegend" src="currentLegend" @scroll={onListViewScroll}  />
                <MDButton variant="flat" class="icon-btn" text="mdi-arrow-left" @tap="currentLegend = null" />
            </GridLayout> -->
</gridlayout>
