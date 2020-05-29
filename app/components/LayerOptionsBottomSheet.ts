import BaseVueComponent from './BaseVueComponent';
import { Component, Prop, Watch } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { $t } from '~/helpers/locale';
import * as appSettings from '@nativescript/core/application-settings/application-settings';
import { RasterTileLayer, RasterTileFilterMode, HillshadeRasterTileLayer } from 'nativescript-carto/layers/raster';
import { action } from 'nativescript-material-dialogs';

@Component({})
export default class LayerOptionsBottomSheet extends BaseVueComponent {
    @Prop() item: SourceItem;

    get actions() {
        const actions = ['delete'];
        if (this.item.provider.cacheable !== false) {
            actions.push('clear_cache');
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
                if ((this.item.layer as any).dataSource instanceof PersistentCacheTileDataSource) {
                    ((this.item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                }
                this.item.layer.clearTileCaches(true);
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
