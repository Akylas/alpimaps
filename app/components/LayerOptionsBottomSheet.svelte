<script lang="ts">
    import { MapBounds, toNativeScreenBounds } from '@nativescript-community/ui-carto/core';
    import { PersistentCacheTileDataSource } from '@nativescript-community/ui-carto/datasources/cache';
    import {
        HillshadeRasterTileLayer,
        RasterTileFilterMode,
        RasterTileLayer
    } from '@nativescript-community/ui-carto/layers/raster';
    import { action } from '@nativescript-community/ui-material-dialogs';
    import { setNumber, setString } from '@nativescript/core/application-settings';
    import { l } from '~/helpers/locale';
    import { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { closeBottomSheet } from './bottomsheet';

    const mapContext = getMapContext();

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
        if (item.legend) {
            res.push('legend');
        }
        if (item.layer instanceof RasterTileLayer || item.layer instanceof HillshadeRasterTileLayer) {
            res.push('tile_filter_mode');
        }
        actions = res;
    }
    let options: { [k: string]: { value?: number; min?: number; max?: number } } = {};
    $: {
        const layer = item.layer;
        const opts = item.options || {};
        // console.log('opts', opts)
        let result = { ...item.options };

        Object.keys(result).forEach((k) => {
            result[k].value = layer[k];
        });
        options = result;
        // const layer = item.layer;
        // return Object.keys(options).forEach(k=> ({
        //     name:k,
        //     value:layer[name],
        //     min:options[k][0] * 100,
        //     max:options[k][1] * 100
        // }))
    }
    function optionValue(name) {
        return Math.round(options[name].value * 100);
        // return Math.round(options * 100);
    }
    function onOptionChanged(name, event) {
        const newValue = event.value / 100;
        item.layer[name] = options[name].value = newValue;
        setNumber(`${item.name}_${name}`, newValue);
    }
    function handleAction(act: string) {
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
                if (dataSource instanceof PersistentCacheTileDataSource) {
                    // const mbtilesPath = path.join(getDataFolder(), 'mbtiles');
                    const zoom = dataSource.maxZoom - 1;
                    // const databasePath = File.fromPath(path.join(mbtilesPath, `${item.provider.id}_${zoom}_${zoom}`))
                    //     .path;
                    // const savedMBTilesDataSource = new PersistentCacheTileDataSource({
                    //     dataSource: dataSource,
                    //     capacity: 1000 * 1024 * 1024,
                    //     databasePath
                    // });
                    const cartoMap = mapContext.getMap();
                    const projection = dataSource.getProjection();
                    const screenBounds = toNativeScreenBounds({
                        min: { x: cartoMap.getMeasuredWidth(), y: 0 },
                        max: { x: 0, y: cartoMap.getMeasuredHeight() }
                    });
                    const bounds = new MapBounds(
                        projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMin()) as any),
                        projection.fromWgs84(cartoMap.screenToMap(screenBounds.getMax()) as any)
                    );
                    dataSource.startDownloadArea(bounds, zoom, zoom, {
                        onDownloadCompleted() {
                            console.log('onDownloadCompleted');
                            // const db = openOrCreate(databasePath);
                            // return Promise.all([
                            //     db.execute('INSERT INTO metadata(name, value) VALUES(?, ?)', ['minZoom', zoom]),
                            //     db.execute('INSERT INTO metadata(name, value) VALUES(?, ?)', ['maxZoom', zoom]),
                            //     db.execute('INSERT INTO metadata(name, value) VALUES(?, ?)', [
                            //         'bounds',
                            //         `${bounds.southwest.lon},${bounds.northeast.lat},${bounds.northeast.lon},${bounds.southwest.lon}`
                            //     ])
                            // ]);
                        },
                        onDownloadFailed(tile: { x: number; y: number; tileId: number }) {
                            console.log('onDownloadFailed', tile);
                        },
                        onDownloadProgress(progress: number) {
                            console.log('onDownloadProgress', progress);
                        },
                        onDownloadStarting(tileCount: number) {
                            console.log('onDownloadStarting', tileCount);
                        }
                    });
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
                                item.layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC);
                                break;
                            case 'bilinear':
                                item.layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR);
                                break;
                            case 'nearest':
                                item.layer.getNative().setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST);
                                break;
                        }
                    });
                }
        }
        closeBottomSheet();
    }
</script>

<scrollview>
    <stacklayout>
        {#each Object.entries(options) as [name, option]}
            <gridlayout height="50" columns="100,*,50">
                <canvaslabel colSpan="3" fontSize="13" color="white" padding="10">
                    <cspan text={name} verticalAlignment="center" paddingLeft="10" horizontalAlignment="left" width="100" />
                    <cspan text={optionValue(name) / 100 + ''} verticalAlignment="center" textAlignment="right" />
                </canvaslabel>
                <mdslider
                    col="1"
                    marginLeft="10"
                    marginRight="10"
                    value={optionValue(name)}
                    on:valueChange={(event) => onOptionChanged(name, event)}
                    minValue={option.min * 100}
                    maxValue={option.max * 100}
                    verticalAlignment="center" />
            </gridlayout>
        {/each}
        <stacklayout orientation="horizontal">
            {#each actions as action}
                <button variant="text" text={l(action)} on:tap={handleAction(action)} />
            {/each}
        </stacklayout>
    </stacklayout>
</scrollview>
