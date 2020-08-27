import BaseVueComponent from './BaseVueComponent';
import { Component, Prop, Watch } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { $t } from '~/helpers/locale';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { RasterTileLayer, RasterTileFilterMode, HillshadeRasterTileLayer } from 'nativescript-carto/layers/raster';
import { action } from 'nativescript-material-dialogs';
import { TileLayer } from 'nativescript-carto/layers';
import { getDataFolder } from '~/utils';
import { File, Folder, path } from '@nativescript/core/file-system';
import { openOrCreate, SQLiteDatabase } from 'nativescript-akylas-sqlite';
import { toNativeScreenBounds, fromNativeMapPos, MapBounds } from 'nativescript-carto/core';

@Component({})
export default class LayerOptionsBottomSheet extends BaseVueComponent {
    @Prop() item: SourceItem;

    get actions() {
        const actions = ['delete'];
        console.log('actions', this.item.provider);
        if (this.item.provider.cacheable !== false) {
            actions.push('clear_cache');
        }
        if (this.item.provider.downloadable === true) {
            actions.push('download');
        }
        if (this.item.legend) {
            actions.push('legend');
        }
        if (this.item.layer instanceof RasterTileLayer || this.item.layer instanceof HillshadeRasterTileLayer) {
            actions.push('tile_filter_mode');
        }
        return actions;
    }
    get options() {
        const layer = this.item.layer;
        const options = this.item.options;
        if (!options) {
            return options;
        }
        Object.keys(options).forEach(k => {
            options[k].value = layer[k];
        });
        return options;
        // const layer = this.item.layer;
        // return Object.keys(options).forEach(k=> ({
        //     name:k,
        //     value:layer[name],
        //     min:options[k][0] * 100,
        //     max:options[k][1] * 100
        // }))
    }
    get optionValue() {
        return name => {
            return Math.round(this.options[name].value * 100);
            // return Math.round(options * 100);
        };
    }
    onOptionChanged(name, event) {
        const newValue = event.value / 100;
        this.item.layer[name] = this.options[name].value = newValue;
        appSettings.setNumber(`${this.item.name}_${name}`, newValue);
    }
    handleAction(act: string) {
        const mapComp = this.$getMapComponent();
        const customLayers = mapComp.mapModules['customLayers'];
        switch (act) {
            case 'delete': {
                customLayers.deleteSource(this.item.name);
                break;
            }
            case 'clear_cache': {
                const layer = this.item.layer as any;
                const dataSource = layer.dataSource;
                if (dataSource instanceof PersistentCacheTileDataSource) {
                    dataSource.clear();
                }
                layer.clearTileCaches(true);
                break;
            }
            case 'download': {
                const layer = this.item.layer as TileLayer<any, any>;
                const dataSource = layer.dataSource;
                if (dataSource instanceof PersistentCacheTileDataSource) {
                    // const mbtilesPath = path.join(getDataFolder(), 'mbtiles');
                    const zoom = dataSource.maxZoom - 1;
                    // const databasePath = File.fromPath(path.join(mbtilesPath, `${this.item.provider.id}_${zoom}_${zoom}`))
                    //     .path;
                    // const savedMBTilesDataSource = new PersistentCacheTileDataSource({
                    //     dataSource: dataSource,
                    //     capacity: 1000 * 1024 * 1024,
                    //     databasePath
                    // });
                    const cartoMap = mapComp.cartoMap;
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
                if (this.item.layer instanceof RasterTileLayer || this.item.layer instanceof HillshadeRasterTileLayer) {
                    action({
                        title: `Tile Filter Mode`,
                        message: 'Pick Action',
                        actions: ['bicubic', 'bilinear', 'nearest']
                    }).then(result => {
                        if (!result) {
                            return;
                        }
                        appSettings.setString(`${this.item.name}_tileFilterMode`, result);
                        // use native for now
                        switch (result) {
                            case 'bicubic':
                                this.item.layer
                                    .getNative()
                                    .setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BICUBIC);
                                break;
                            case 'bilinear':
                                this.item.layer
                                    .getNative()
                                    .setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_BILINEAR);
                                break;
                            case 'nearest':
                                this.item.layer
                                    .getNative()
                                    .setTileFilterMode(RasterTileFilterMode.RASTER_TILE_FILTER_MODE_NEAREST);
                                break;
                        }
                    });
                }
        }
        this.$closeBottomSheet();
    }
}
