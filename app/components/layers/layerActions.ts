// A layer's maintenance actions, shared by the layers list row menu and the layer settings sheet.
import { GestureRootView } from '@nativescript-community/gesturehandler';
import { ComponentInstanceInfo, resolveComponentElement } from '@nativescript-community/svelte-native/dom';
import type { MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { action, confirm } from '@nativescript-community/ui-material-dialogs';
import { ApplicationSettings, File, ScrollView } from '@nativescript/core';
import type SettingsSlider__SvelteComponent_ from '@shared/components/SettingsSlider.svelte';
import { formatSize } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { SourceItem } from '~/mapModules/CustomLayersModule';
import { getMapContext } from '~/mapModules/MapModule';
import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
import { createView } from '~/utils/ui';

export type LayerAction = 'delete' | 'cache_only_mode' | 'clear_cache' | 'download_area' | 'tile_filter_mode';

export function layerSource(item: SourceItem) {
    // a reference: destroying it leaves the layer's own source intact
    const source = item.layer.source() as MassifSource<'massif::PersistentCacheTileDataSource'>;
    const persistent = !!source?.is('massif::PersistentCacheTileDataSource');
    return { source, persistent };
}

export function layerCapabilities(item: SourceItem) {
    const devMode = getMapContext().mapModule('customLayers').devMode;
    const { persistent, source } = layerSource(item);
    return {
        persistent,
        canCacheOnly: !item.local && persistent,
        cacheOnlyMode: persistent && !!source.get('cacheOnlyMode'),
        downloadable: !item.local && (!!item.provider.downloadable || devMode) && !item.downloading,
        cacheable: !!item.provider.cacheable || !PRODUCTION,
        filterable: item.layer.is('massif::RasterTileLayer') || item.layer.is('massif::HillshadeRasterTileLayer'),
        removable: !item.local
    };
}

/** The cache database size, when the layer has one. */
export function layerCacheSize(item: SourceItem) {
    // `databasePath` is constructor-only on the source, so it can't be read back from it
    const { databasePath } = item;
    if (layerSource(item).persistent && databasePath && File.exists(databasePath)) {
        return formatSize(File.fromPath(databasePath).size);
    }
    return null;
}

async function downloadArea(item: SourceItem, source: MassifSource<'massif::PersistentCacheTileDataSource'>) {
    const mapContext = getMapContext();
    const view = createView(ScrollView, {
        height: ALERT_OPTION_MAX_HEIGHT - 80
    });
    const stackLayout = createView(GestureRootView, {
        padding: 10,
        rows: 'auto,auto'
    });
    const SettingsSlider = (await import('@shared/components/SettingsSlider.svelte')).default;
    const minSliderInstance: ComponentInstanceInfo = resolveComponentElement(SettingsSlider, {
        title: lc('min_zoom'),
        subtitle: lc('dowload_area_minzoom'),
        icon: 'mdi-chevron-down',
        max: item.provider.sourceOptions.maxZoom,
        step: 1,
        valueFormatter: (value) => value + '',
        min: 0,
        value: Math.round(mapContext.getMap().camera().zoom())
    });
    const maxSliderInstance: ComponentInstanceInfo = resolveComponentElement(SettingsSlider, {
        row: 1,
        title: lc('max_zoom'),
        subtitle: lc('dowload_area_maxzoom'),
        icon: 'mdi-chevron-up',
        max: item.provider.sourceOptions.maxZoom,
        min: 0,
        valueFormatter: (value) => value + '',
        step: 1,
        value: item.provider.sourceOptions.maxZoom - 1
    });
    stackLayout.addChild(minSliderInstance.element.nativeView);
    stackLayout.addChild(maxSliderInstance.element.nativeView);
    view.content = stackLayout;
    const result = await confirm({
        title: lc('download'),
        message: lc('confirm_area_download'),
        view,
        okButtonText: lc('ok'),
        cancelButtonText: lc('cancel')
    });
    const minZoom = (minSliderInstance.viewInstance as SettingsSlider__SvelteComponent_).value;
    const maxZoom = (maxSliderInstance.viewInstance as SettingsSlider__SvelteComponent_).value;
    minSliderInstance.element.nativeElement._tearDownUI();
    minSliderInstance.viewInstance.$destroy();
    maxSliderInstance.element.nativeElement._tearDownUI();
    maxSliderInstance.viewInstance.$destroy();
    if (result) {
        const customLayers = mapContext.mapModule('customLayers');
        if (customLayers && source) {
            customLayers.downloadDataSource({ source, provider: item.provider, minZoom, maxZoom });
        }
    }
}

async function pickTileFilterMode(item: SourceItem) {
    const result = await action({
        title: lc('tile_filter_mode'),
        actions: ['bicubic', 'bilinear', 'nearest']
    });
    if (!result) {
        return;
    }
    ApplicationSettings.setString(`${item.name}_tileFilterMode`, result);
    // use native for now
    switch (result) {
        case 'bicubic':
            item.layer.set('tileFilterMode', 'RASTER_TILE_FILTER_MODE_BICUBIC');
            break;
        case 'bilinear':
            item.layer.set('tileFilterMode', 'RASTER_TILE_FILTER_MODE_BILINEAR');
            break;
        case 'nearest':
            item.layer.set('tileFilterMode', 'RASTER_TILE_FILTER_MODE_NEAREST');
            break;
    }
}

export async function runLayerAction(item: SourceItem, layerAction: LayerAction) {
    const customLayers = getMapContext().mapModule('customLayers');
    const { persistent, source } = layerSource(item);
    switch (layerAction) {
        case 'delete':
            customLayers.deleteSource(item);
            break;
        case 'cache_only_mode':
            if (persistent) {
                const cacheOnlyMode = !source.get('cacheOnlyMode');
                source.set('cacheOnlyMode', cacheOnlyMode);
                ApplicationSettings.setBoolean(`${item.name}_cacheOnlyMode`, cacheOnlyMode);
            }
            break;
        case 'clear_cache':
            if (persistent) {
                source.call('clear');
            }
            item.layer.call('clearTileCaches', true);
            break;
        case 'download_area':
            await downloadArea(item, source);
            break;
        case 'tile_filter_mode':
            if (layerCapabilities(item).filterable) {
                await pickTileFilterMode(item);
            }
            break;
    }
}
