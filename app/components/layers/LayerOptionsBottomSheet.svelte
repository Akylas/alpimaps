<script lang="ts">
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { ApplicationSettings, Color } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { onMount } from 'svelte';
    import Pill from '~/components/common/Pill.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import { type LayerAction, layerCacheSize, layerCapabilities, layerTitle, runLayerAction } from '~/components/layers/layerActions';
    import { lc } from '~/helpers/locale';
    import type { SourceItem } from '~/mapModules/CustomLayersModule';
    import { pickColor } from '~/utils/utils';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import { localMapOnlineFallback, localTerrainOnlineFallback } from '~/mapModules/localData/scan';
    import { colors } from '~/variables';

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant } = $colors);

    export let item: SourceItem;

    let scrollView;
    let capabilities = layerCapabilities(item);
    // a Local item's tiles can come from the matching online source where no archive has them
    const onlineFallback = item.local
        ? item.terrain
            ? { store: localTerrainOnlineFallback, title: lc('local_terrain_online_fallback') }
            : { store: localMapOnlineFallback, title: lc('local_map_online_fallback') }
        : null;
    const cacheSize = layerCacheSize(item);

    // the style's raw parameter names, readable where they are known
    const OPTION_LABELS: Record<string, string> = {
        contrast: 'contrast',
        heightScale: 'height_scale',
        zoomLevelBias: 'zoom_level_bias',
        highlightColor: 'highlight_color',
        accentColor: 'accent_color',
        shadowColor: 'shadow_color',
        illuminationDirection: 'illumination_direction',
        minVisibleZoom: 'min_visible_zoom',
        maxVisibleZoom: 'max_visible_zoom'
    };
    function optionLabel(name: string) {
        return OPTION_LABELS[name] ? lc(OPTION_LABELS[name]) : name;
    }

    let options: {
        [k: string]: {
            type?: string;
            value?: any;
            min?: number;
            max?: number;
            transform?: Function;
            transformBack?: Function;
            read?: (layer: SourceItem['layer']) => number;
            write?: (layer: SourceItem['layer'], value: number) => void;
        };
    } = {};
    onMount(() => {
        const layer = item.layer;
        const opts = item.options || {};
        const result = { ...item.options };

        Object.keys(result).forEach((k) => {
            // layer.get, not layer[k]: a surface handle has no JS properties
            const value = opts[k].read ? opts[k].read(layer) : layer.get(k);
            result[k].value = opts[k].transformBack ? opts[k].transformBack(value) : value;
        });
        options = result;
    });
    // a colour comes back from the layer as an argb number, not the css string a view takes
    function optionColor(name: string) {
        const value = options[name].value;
        if (value === undefined || value === null || value === '') {
            return null;
        }
        try {
            return new Color(value).hex;
        } catch (error) {
            return null;
        }
    }
    function optionValue(name: string) {
        return Math.round(options[name].value * 100);
    }
    function onOptionChanged(name, event) {
        let newValue = (event.value || 0) / 100;
        ApplicationSettings.setNumber(`${item.name}_${name}`, newValue);
        options[name].value = newValue;
        if (options[name].transform) {
            newValue = options[name].transform(newValue);
        }
        if (options[name].write) {
            options[name].write(item.layer, newValue);
        } else {
            item.layer.set(name, newValue);
        }
    }
    async function pickOptionColor(name: string, color: string) {
        try {
            const newColor = await pickColor(color ? new Color(color) : null);
            if (!newColor) {
                return;
            }
            ApplicationSettings.setString(`${item.name}_${name}`, newColor.hex);
            options[name].value = newColor.hex;
            // argb, the form every colour property on a layer is written in
            item.layer.set(name, newColor.argb);
        } catch (err) {
            showError(err);
        }
    }
    async function handleAction(layerAction: LayerAction) {
        try {
            await runLayerAction(item, layerAction);
            if (layerAction === 'cache_only_mode' || layerAction === 'tile_filter_mode') {
                capabilities = layerCapabilities(item);
                return;
            }
            closeBottomSheet();
        } catch (error) {
            showError(error);
        }
    }

    $: sliderOptions = Object.entries(options).filter(([, option]) => option.type !== 'color');
    $: colorOptions = Object.entries(options).filter(([, option]) => option.type === 'color');
</script>

<gesturerootview class="bottomsheet" {...$$restProps} height={420} rows="auto,auto,*,auto">
    <PanelHeader icon="mdi-tune-variant" subtitle={cacheSize} title={layerTitle(item)} />
    <wraplayout padding="0 12" row={1}>
        {#if capabilities.downloadable}
            <Pill icon="mdi-download" label={lc('download')} on:tap={() => handleAction('download_area')} />
        {/if}
        {#if capabilities.canCacheOnly}
            <Pill icon="mdi-cloud-off-outline" label={lc('cache_only_mode')} selected={capabilities.cacheOnlyMode} on:tap={() => handleAction('cache_only_mode')} />
        {/if}
        {#if capabilities.filterable}
            <Pill icon="mdi-filter-cog" label={lc('tile_filter_mode')} on:tap={() => handleAction('tile_filter_mode')} />
        {/if}
    </wraplayout>
    <scrollview bind:this={scrollView} id="scrollView" row={2}>
        <stacklayout padding="0 4">
            {#if onlineFallback}
                <label class="sectionHeader" text={lc('online_fallback')} />
                <StoreSwitch description={lc('online_fallback_description')} store={onlineFallback.store} title={onlineFallback.title} />
            {/if}
            {#if sliderOptions.length}
                <label class="sectionHeader" text={lc('rendering')} />
            {/if}
            {#each sliderOptions as [name, option]}
                <gridlayout columns="*,auto" padding="4 16 0 16" rows="auto,auto">
                    <label color={colorOnSurface} fontSize={15} text={optionLabel(name)} />
                    <label col={1} color={colorOnSurfaceVariant} fontSize={14} text={optionValue(name) / 100 + ''} />
                    <slider
                        colSpan={2}
                        marginLeft={-8}
                        marginRight={-8}
                        maxValue={option.max * 100}
                        minValue={option.min * 100}
                        row={1}
                        value={optionValue(name)}
                        on:valueChange={(event) => onOptionChanged(name, event)} />
                </gridlayout>
            {/each}
            {#if colorOptions.length}
                <label class="sectionHeader" text={lc('colors')} />
            {/if}
            {#each colorOptions as [name]}
                <gridlayout columns="*,auto" height={52} padding="0 16" rippleColor={colorOnSurface} on:tap={() => pickOptionColor(name, optionColor(name))}>
                    <label color={colorOnSurface} fontSize={15} text={optionLabel(name)} verticalAlignment="middle" />
                    <stacklayout col={1} orientation="horizontal" verticalAlignment="middle">
                        <label color={colorOnSurfaceVariant} fontSize={13} marginRight={10} text={optionColor(name)?.toUpperCase()} verticalAlignment="middle" />
                        <absolutelayout backgroundColor={optionColor(name)} borderColor={colorHairline} borderRadius={16} borderWidth={1} height={32} width={32} />
                    </stacklayout>
                </gridlayout>
            {/each}
        </stacklayout>
    </scrollview>
    <wraplayout padding="4 12 8 12" row={3}>
        {#if capabilities.cacheable}
            <Pill icon="mdi-clock-remove-outline" label={lc('clear_cache')} on:tap={() => handleAction('clear_cache')} />
        {/if}
        {#if capabilities.removable}
            <Pill danger={true} icon="mdi-delete" label={lc('remove_layer')} on:tap={() => handleAction('delete')} />
        {/if}
    </wraplayout>
</gesturerootview>
