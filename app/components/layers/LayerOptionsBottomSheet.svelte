<script lang="ts">
    import type { MassifSource } from '@nativescript-community/ui-massifmaps/api';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { action, confirm } from '@nativescript-community/ui-material-dialogs';
    import { ApplicationSettings, Color, File, ScrollView, StackLayout } from '@nativescript/core';
    import { onMount } from 'svelte';
    import { formatSize } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { showError } from '@shared/utils/showError';
    import { pickColor } from '~/utils/utils';
    import { colors } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import { createView } from '~/utils/ui';
    $: ({ colorBackground, colorError, colorOnSurfaceVariant, colorOutlineVariant } = $colors);
    import { ComponentInstanceInfo, resolveComponentElement } from '@nativescript-community/svelte-native/dom';
    import type SettingsSlider__SvelteComponent_ from '@shared/components/SettingsSlider.svelte';
    import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
    import { GestureRootView } from '@nativescript-community/gesturehandler';

    const mapContext = getMapContext();
    let scrollView;
    const devMode = mapContext.mapModule('customLayers').devMode;
    export let item: SourceItem;

    $: downloadable = item.provider.downloadable || devMode;
    $: cacheable = item.provider.cacheable || !PRODUCTION;
    // the layer's source, held for the length of this sheet: it is a reference, and destroying it
    // does not touch the layer's own
    $: source = item.layer.source() as MassifSource<'massif::PersistentCacheTileDataSource'>;
    $: persistent = !!source?.is('massif::PersistentCacheTileDataSource');
    $: cacheOnlyMode = persistent && source.get('cacheOnlyMode');
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
        const result = { ...item.options };

        Object.keys(result).forEach((k) => {
            // a surface handle has no JS properties: reading one gives undefined, and transformBack
            // then dereferences it
            const value = layer.get(k as never);
            result[k].value = opts[k].transformBack ? opts[k].transformBack(value) : value;
        });
        options = result;
    });
    function optionValue(name) {
        if (options[name].type === 'color') {
            return options[name].value;
        }
        return Math.round(options[name].value * 100);
        // return Math.round(options * 100);
    }
    function onOptionChanged(name, event) {
        let newValue = (event.value || 0) / 100;
        ApplicationSettings.setNumber(`${item.name}_${name}`, newValue);
        options[name].value = newValue;
        if (options[name].transform) {
            newValue = options[name].transform(newValue);
        }
        item.layer.set(name as never, newValue as never);
    }
    async function pickOptionColor(name, color: Color) {
        try {
            const newColor = await pickColor(color);
            if (!newColor) {
                return;
            }
            ApplicationSettings.setString(`${item.name}_${name}`, newColor.hex);
            options[name].value = newColor.hex;
            // argb, the same form createHillshadeTileLayer builds these colours with
            item.layer.set(name as never, newColor.argb as never);
        } catch (err) {
            showError(err);
        }
    }
    async function handleAction(act: string) {
        try {
            DEV_LOG && console.log('handleAction', act);
            const customLayers = mapContext.mapModule('customLayers');
            switch (act) {
                case 'delete': {
                    customLayers.deleteSource(item);
                    break;
                }
                case 'cache_only_mode': {
                    if (persistent) {
                        cacheOnlyMode = !cacheOnlyMode;
                        source.set('cacheOnlyMode', cacheOnlyMode);
                        ApplicationSettings.setBoolean(`${item.name}_cacheOnlyMode`, cacheOnlyMode);
                    }
                    //dont close the bottom sheet
                    return;
                }
                case 'clear_cache': {
                    if (persistent) {
                        source.call('clear');
                    }
                    item.layer.call('clearTileCaches', true);
                    break;
                }
                case 'download_area': {
                    const view = createView(ScrollView, {
                        height: ALERT_OPTION_MAX_HEIGHT - 80
                    });
                    const stackLayout = createView(GestureRootView, {
                        padding: 10,
                        rows: 'auto,auto'
                    });
                    const SettingsSlider = (await import('@shared/components/SettingsSlider.svelte')).default;
                    const massifMap = mapContext.getMap();
                    const minSliderInstance = resolveComponentElement(SettingsSlider, {
                        title: lc('min_zoom'),
                        subtitle: lc('dowload_area_minzoom'),
                        icon: 'mdi-chevron-down',
                        max: item.provider.sourceOptions.maxZoom,
                        step: 1,
                        valueFormatter: (value) => value + '',
                        min: 0,
                        value: Math.round(mapContext.getMap().camera().zoom())
                    });
                    const maxSliderInstance = resolveComponentElement(SettingsSlider, {
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
                            customLayers.downloadDataSource({ source: source as never, provider: item.provider, minZoom, maxZoom });
                        }
                    }
                    break;
                }
                case 'tile_filter_mode':
                    if (item.layer.is('massif::RasterTileLayer') || item.layer.is('massif::HillshadeRasterTileLayer')) {
                        const result = await action({
                            title: lc('tile_filter_mode'),
                            actions: ['bicubic', 'bilinear', 'nearest']
                        });
                        if (result) {
                            ApplicationSettings.setString(`${item.name}_tileFilterMode`, result);
                            // use native for now
                            switch (result) {
                                case 'bicubic':
                                    item.layer.set('tileFilterMode' as never, 'RASTER_TILE_FILTER_MODE_BICUBIC' as never);
                                    break;
                                case 'bilinear':
                                    item.layer.set('tileFilterMode' as never, 'RASTER_TILE_FILTER_MODE_BILINEAR' as never);
                                    break;
                                case 'nearest':
                                    item.layer.set('tileFilterMode' as never, 'RASTER_TILE_FILTER_MODE_NEAREST' as never);
                                    break;
                            }
                        }
                    }
                    //dont close the bottom sheet
                    return;
            }
            closeBottomSheet();
        } catch (error) {
            showError(error);
        }
    }

    function getTitle() {
        let result = item.name.toUpperCase();
        if (persistent) {
            const databasePath = source.get('databasePath' as never) as string;
            if (databasePath && File.exists(databasePath)) {
                result += ` (${formatSize(File.fromPath(databasePath).size)})`;
            }
        }
        return result;
    }
</script>

<gesturerootview {...$$restProps} height={240}>
    <gridlayout columns="*,auto" rows="auto,*">
        <label fontSize={20} fontWeight="bold" padding="10 10 0 20" text={getTitle()} />
        <scrollview bind:this={scrollView} id="scrollView" row={1}>
            <stacklayout>
                {#each Object.entries(options) as [name, option]}
                    {#if option.type === 'color'}
                        <gridlayout columns="*" height={50} on:tap={() => pickOptionColor(name, optionValue(name))}>
                            <canvaslabel fontSize={13} padding={10}>
                                <cspan horizontalAlignment="left" paddingLeft={10} text={name} verticalAlignment="middle" width={100} />
                                <circle
                                    antiAlias={true}
                                    fillColor={colorOnSurfaceVariant}
                                    horizontalAlignment="right"
                                    paintStyle="fill"
                                    radius={15}
                                    strokeWidth={2}
                                    verticalAlignment="middle"
                                    width={20} />
                                <circle
                                    antiAlias={true}
                                    fillColor={optionValue(name)}
                                    horizontalAlignment="right"
                                    paintStyle="fill_and_stroke"
                                    radius={15}
                                    strokeColor={colorOnSurfaceVariant}
                                    strokeWidth={2}
                                    verticalAlignment="middle"
                                    width={20} />
                            </canvaslabel>
                        </gridlayout>
                    {:else}
                        <gridlayout columns="100,*,30" height={50}>
                            <canvaslabel colSpan={3} fontSize={13} padding={10}>
                                <cspan horizontalAlignment="left" paddingLeft={10} text={name} verticalAlignment="middle" width={100} />
                                <cspan text={optionValue(name) / 100 + ''} textAlignment="right" verticalAlignment="middle" />
                            </canvaslabel>
                            <slider
                                col={1}
                                marginLeft={10}
                                marginRight={10}
                                maxValue={option.max * 100}
                                minValue={option.min * 100}
                                value={optionValue(name)}
                                verticalAlignment="middle"
                                on:valueChange={(event) => onOptionChanged(name, event)} />
                        </gridlayout>
                    {/if}
                {/each}
            </stacklayout>
        </scrollview>
        <stacklayout borderLeftColor={colorOutlineVariant} borderLeftWidth={1} col={1} rowSpan={2}>
            <IconButton gray={true} isVisible={cacheable !== false} text="mdi-clock-remove-outline" tooltip={lc('clear_cache')} on:tap={() => handleAction('clear_cache')} />
            <IconButton
                gray={true}
                isVisible={!item.local && persistent}
                text={cacheOnlyMode ? 'mdi-cloud-off-outline' : 'mdi-cloud-download-outline'}
                tooltip={lc('cache_only_mode')}
                on:tap={() => handleAction('cache_only_mode')} />
            <IconButton
                gray={true}
                isVisible={!item.local && (devMode || downloadable) && !item.downloading}
                text="mdi-download"
                tooltip={lc('download_area')}
                on:tap={() => handleAction('download_area')} />
            <IconButton
                gray={true}
                isVisible={item.layer.is('massif::RasterTileLayer') || item.layer.is('massif::HillshadeRasterTileLayer')}
                text="mdi-filter-cog"
                tooltip={lc('tile_filter_mode')}
                on:tap={() => handleAction('tile_filter_mode')} />
            <IconButton color={colorError} isVisible={!item.local} text="mdi-delete" tooltip={lc('delete')} on:tap={() => handleAction('delete')} />
        </stacklayout>
        <!-- <collectionview orientation="horizontal" row={2} height={40} items={actions} colWidth="auto">
        <Template let:item>
            <gridlayout>
                <mdbutton variant="outline" padding={10} marginRight={10} text={l(item)} on:tap={() => handleAction(item)} />
            </gridlayout>
        </Template>
    </collectionview> -->
    </gridlayout>
</gesturerootview>
