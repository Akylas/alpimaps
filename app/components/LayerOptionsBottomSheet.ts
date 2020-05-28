
import BaseVueComponent from './BaseVueComponent';
import { Component, Prop, Watch } from 'vue-property-decorator';
import CustomLayersModule, { SourceItem } from '~/mapModules/CustomLayersModule';
import { PersistentCacheTileDataSource } from 'nativescript-carto/datasources/cache';
import { $t } from '~/helpers/locale';
import * as appSettings from '@nativescript/core/application-settings/application-settings';

@Component({})
export default class LayerOptionsBottomSheet extends BaseVueComponent {
    @Prop() item: SourceItem


    get actions() {
        const actions = [$t('delete')];
        if (this.item.provider.cacheable !== false) {
            actions.push($t('clear_cache'));
        }
        if (this.item.legend) {
            actions.push($t('legend'));
        }
        return actions;
    }
    get options() {
        const layer = this.item.layer;
        const options =  this.item.options;
        if (!options) {
            return options;
        }
        Object.keys(options).forEach(k=>{
            options[k].value = layer[k];
        })
        console.log('options', options);
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
        return name=>{
            console.log('optionValue', name, this.options[name].value);
            return Math.round(this.options[name].value * 100);
            // return Math.round(options * 100);
        }
    }
    onOptionChanged(name, event) {
        const newValue = event.value / 100;
        this.log('onOptionChanged', name, newValue);
        this.item.layer[name] = this.options[name].value = newValue;
        appSettings.setNumber(`${this.item.name}_${name}`, newValue);
    }
    handleAction(action:string) { 
        const mapComp = this.$getMapComponent();
        const customLayers = mapComp.mapModules['customLayers'];
        switch (action) {
            case 'delete': {
                customLayers.deleteSource(this.item.name);
                break;
            }
            case 'clear_cache': {
                ((this.item.layer as any).dataSource as PersistentCacheTileDataSource).clear();
                this.item.layer.clearTileCaches(true);
                break;
            }
        }
        this.$closeBottomSheet();
    }
}