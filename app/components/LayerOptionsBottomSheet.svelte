<script lang="ts">
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import { HillshadeRasterTileLayer, RasterTileFilterMode, RasterTileLayer } from '@nativescript-community/ui-carto/layers/raster';
    import { action } from '@nativescript-community/ui-material-dialogs';
    import { Color, File } from '@nativescript/core';
    import { setNumber, setString } from '@nativescript/core/application-settings';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { formatSize } from '~/helpers/formatter';
    import { l, lc } from '~/helpers/locale';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { showError } from '~/utils/error';
    import { closeBottomSheet } from '~/utils/svelte/bottomsheet';
    import { pickColor } from '~/utils/utils';
    import { borderColor, textLightColor } from '~/variables';
    import IconButton from './IconButton.svelte';

    const mapContext = getMapContext();
    let scrollView;
    const devMode = mapContext.mapModule('customLayers').devMode;
    export let item: SourceItem;
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
        try {
            const newColor = await pickColor(color, scrollView.nativeView);
            if (!newColor) {
                return;
            }
            setString(`${item.name}_${name}`, newColor.hex);
            options[name].value = newColor.hex;
            item.layer[name] = newColor;
        } catch (err) {
            showError(err);
        }
    }
    async function handleAction(act: string) {
        const customLayers = mapContext.mapModule('customLayers');
        switch (act) {
            case 'delete': {
                customLayers.deleteSource(item);
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
            case 'download_area': {
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
                    const result = await action({
                        title: lc('tile_filter_mode'),
                        actions: ['bicubic', 'bilinear', 'nearest']
                    });
                    if (result) {
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
                    }
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

<gridlayout rows="auto,*" columns="*,auto" height={240}>
    <label text={getTitle()} fontWeight="bold" padding="10 10 0 20" fontSize={20} colSpan={2} />
    <scrollview row={1} bind:this={scrollView} id="scrollView">
        <stacklayout>
            {#each Object.entries(options) as [name, option]}
                {#if option.type === 'color'}
                    <gridlayout height={50} columsn="*" on:tap={pickOptionColor(name, optionValue(name))}>
                        <canvaslabel fontSize={13} padding={10}>
                            <cspan text={name} verticalAlignment="middle" paddingLeft={10} horizontalAlignment="left" width={100} />
                            <circle strokeWidth={2} paintStyle="fill" fillColor={$textLightColor} radius={15} antiAlias={true} horizontalAlignment="right" verticalAlignment="middle" width={20} />
                            <circle
                                strokeWidth={2}
                                paintStyle="fill_and_stroke"
                                strokeColor={$textLightColor}
                                fillColor={optionValue(name)}
                                radius={15}
                                antiAlias={true}
                                horizontalAlignment="right"
                                verticalAlignment="middle"
                                width={20}
                            />
                        </canvaslabel>
                    </gridlayout>
                {:else}
                    <gridlayout height={50} columns="100,*,50">
                        <canvaslabel colSpan={3} fontSize={13} padding={10}>
                            <cspan text={name} verticalAlignment="middle" paddingLeft={10} horizontalAlignment="left" width={100} />
                            <cspan text={optionValue(name) / 100 + ''} verticalAlignment="middle" textAlignment="right" />
                        </canvaslabel>
                        <slider
                            col={1}
                            marginLeft={10}
                            marginRight={10}
                            value={optionValue(name)}
                            on:valueChange={(event) => onOptionChanged(name, event)}
                            minValue={option.min * 100}
                            maxValue={option.max * 100}
                            verticalAlignment="middle"
                        />
                    </gridlayout>
                {/if}
            {/each}
        </stacklayout>
    </scrollview>
    <stacklayout row={1} col={1} borderLeftColor={$borderColor} borderLeftWidth={1}>
        <IconButton gray={true} isVisible={item.provider.cacheable !== false} text="mdi-clock-remove-outline" tooltip={lc('clear_cache')} on:tap={() => handleAction('clear_cache')} />
        <IconButton
            gray={true}
            isVisible={!item.local && (devMode || item.provider.downloadable === true) && !item.downloading}
            text="mdi-download"
            tooltip={lc('download_area')}
            on:tap={() => handleAction('download_area')}
        />
        <IconButton
            gray={true}
            isVisible={item.layer instanceof RasterTileLayer || item.layer instanceof HillshadeRasterTileLayer}
            text="mdi-filter-cog"
            tooltip={lc('tile_filter_mode')}
            on:tap={() => handleAction('tile_filter_mode')}
        />
        <IconButton color="red" text="mdi-delete" tooltip={lc('delete')} on:tap={() => handleAction('delete')} />
    </stacklayout>
    <!-- <collectionview orientation="horizontal" row={2} height={40} items={actions} colWidth="auto">
        <Template let:item>
            <gridlayout>
                <mdbutton variant="outline" padding={10} marginRight={10} text={l(item)} on:tap={() => handleAction(item)} />
            </gridlayout>
        </Template>
    </collectionview> -->
</gridlayout>
