<script lang="ts">
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { HillshadeRasterTileLayer, RasterTileFilterMode, RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import { action } from '@nativescript-community/ui-material-dialogs';
    import { Color, File } from '@nativescript/core';
    import { setNumber, setString } from '@nativescript/core/application-settings';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { formatSize } from '~/helpers/formatter';
    import { l } from '~/helpers/locale';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { showError } from '~/utils/error';
    import { pickColor } from '~/utils/utils';
    import { textLightColor } from '~/variables';
    import { closeBottomSheet } from './bottomsheet';

    const mapContext = getMapContext();
    let scrollView;
    export let item: SourceItem;
    let actions: string[] = [];
    $: {
        const res = ['delete'];
        // console.log('actions', item.provider);
        if (item.provider.cacheable !== false) {
            res.push('clear_cache');
        }
        if (item.provider.downloadable === true) {
            res.push('download');
        }
        // if (item.legend) {
        //     res.push('legend');
        // }
        if (item.layer instanceof RasterTileLayer || item.layer instanceof HillshadeRasterTileLayer) {
            res.push('tile_filter_mode');
        }
        actions = res;
    }
    let options: {
        [k: string]: {
            type?: string;
            value?: any;
            min?: number;
            max?: number;
            transform?: Function;
            transformBack?: Function;
        };
    } = {};
    onMount(() => {
        const layer = item.layer;
        const opts = item.options || {};
        let result = { ...item.options };

        Object.keys(result).forEach((k) => {
            result[k].value = opts[k].transformBack ? opts[k].transformBack(layer[k]) : layer[k];
        });
        options = result;
    });
    function optionValue(name) {
        if (options[name].type === 'color') {
            return options[name].value as any;
        }
        return Math.round(options[name].value * 100);
        // return Math.round(options * 100);
    }
    function onOptionChanged(name, event) {
        let newValue = (event.value || 0) / 100;
        setNumber(`${item.name}_${name}`, newValue);
        options[name].value = newValue;
        if (options[name].transform) {
            newValue = options[name].transform(newValue);
        }
        item.layer[name] = newValue;
    }
    async function pickOptionColor(name, color: Color) {
        // console.log('pickOptionColor', name, color, typeof color);
        try {
            const newColor = await pickColor(color, scrollView.nativeView);
            setString(`${item.name}_${name}`, newColor.hex);
            options[name].value = newColor.hex;
            item.layer[name] = newColor;
            // console.log('item.layer', name, newColor, item.layer);
        } catch (err) {
            showError(err);
        }
    }
    async function handleAction(act: string) {
        const customLayers = mapContext.mapModule('customLayers');
        switch (act) {
            case 'delete': {
                customLayers.deleteSource(item.name);
                break;
            }
            case 'clear_cache': {
                const layer = item.layer as any;
                const dataSource = layer.dataSource;
                if (dataSource instanceof PersistentCacheTileDataSource) {
                    dataSource.clear();
                }
                layer.clearTileCaches(true);
                break;
            }
            case 'download': {
                const layer = item.layer;
                const dataSource = layer.dataSource;
                const customLayers = mapContext.mapModule('customLayers');
                if (customLayers) {
                    customLayers.downloadDataSource(dataSource, item.provider);
                }
                break;
            }
            case 'tile_filter_mode':
                if (item.layer instanceof RasterTileLayer || item.layer instanceof HillshadeRasterTileLayer) {
                    action({
                        title: 'Tile Filter Mode',
                        message: 'Pick Action',
                        actions: ['bicubic', 'bilinear', 'nearest']
                    }).then((result) => {
                        if (!result) {
                            return;
                        }
                        setString(`${item.name}_tileFilterMode`, result);
                        // use native for now
                        switch (result) {
                            case 'bicubic':
                                (item.layer as RasterTileLayer).tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC;
                                break;
                            case 'bilinear':
                                (item.layer as RasterTileLayer).tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR;
                                break;
                            case 'nearest':
                                (item.layer as RasterTileLayer).tileFilterMode = RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST;
                                break;
                        }
                    });
                }
        }
        closeBottomSheet();
    }

    function getTitle() {
        let result = item.name.toUpperCase();
        const dataSource = item.layer.dataSource;
        if (dataSource instanceof PersistentCacheTileDataSource) {
            const databasePath = dataSource.options.databasePath;
            result += ` (${formatSize(File.fromPath(databasePath).size)})`;
        }
        return result;
    }
</script>

<gridlayout rows="auto,*,auto" height="240">
    <label text={getTitle()} fontWeight="bold" padding="10 10 0 20" fontSize="20" />
    <scrollview row={1} bind:this={scrollView} height="200" id="scrollView">
        <stacklayout>
            {#each Object.entries(options) as [name, option]}
                {#if option.type === 'color'}
                    <gridlayout height="50" columsn="*" on:tap={pickOptionColor(name, optionValue(name))}>
                        <canvaslabel fontSize="13" padding="10">
                            <cspan text={name} verticalAlignment="center" paddingLeft="10" horizontalAlignment="left" width="100" />
                            <circle strokeWidth="2" paintStyle="fill" fillColor={$textLightColor} radius="15" antiAlias={true} horizontalAlignment="right" verticalAlignment="middle" width="20" />
                            <circle
                                strokeWidth="2"
                                paintStyle="fill_and_stroke"
                                strokeColor={$textLightColor}
                                fillColor={optionValue(name)}
                                radius="15"
                                antiAlias={true}
                                horizontalAlignment="right"
                                verticalAlignment="middle"
                                width="20"
                            />
                        </canvaslabel>
                    </gridlayout>
                {:else}
                    <gridlayout height="50" columns="100,*,50">
                        <canvaslabel colSpan={3} fontSize="13" padding="10">
                            <cspan text={name} verticalAlignment="center" paddingLeft="10" horizontalAlignment="left" width="100" />
                            <cspan text={optionValue(name) / 100 + ''} verticalAlignment="center" textAlignment="right" />
                        </canvaslabel>
                        <slider
                            col={1}
                            marginLeft="10"
                            marginRight="10"
                            value={optionValue(name)}
                            on:valueChange={(event) => onOptionChanged(name, event)}
                            minValue={option.min * 100}
                            maxValue={option.max * 100}
                            verticalAlignment="center"
                        />
                    </gridlayout>
                {/if}
            {/each}
        </stacklayout>
    </scrollview>
    <collectionview orientation="horizontal" row={2} height="40" items={actions} colWidth="auto">
        <Template let:item>
            <gridlayout>
                <button variant="outline" padding="10" marginRight="10" text={l(item)} on:tap={() => handleAction(item)} />
            </gridlayout>
        </Template>
    </collectionview>
</gridlayout>
