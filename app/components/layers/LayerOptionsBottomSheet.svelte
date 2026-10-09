<script lang="ts">
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { ApplicationSettings } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { onDestroy } from 'svelte';
    import { type Writable, writable } from 'svelte/store';
    import Pill from '~/components/common/Pill.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import { type LayerAction, layerCacheSize, layerCapabilities, layerTitle, runLayerAction } from '~/components/layers/layerActions';
    import { lc } from '~/helpers/locale';
    import type { LayerOption, SourceItem } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import StoreColor from '~/components/settings/StoreColor.svelte';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import { localMapOnlineFallback, localTerrainOnlineFallback } from '~/mapModules/localData/scan';

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
        opacity: 'opacity',
        contrast: 'contrast',
        heightScale: 'height_scale',
        zoomLevelBias: 'zoom_level_bias',
        highlightColor: 'highlight_color',
        accentColor: 'accent_color',
        shadowColor: 'shadow_color',
        illuminationDirection: 'illumination_direction',
        illuminationMapRotationEnabled: 'light_rotates_with_map',
        hillshadeMethod: 'hillshade_method',
        exaggeration: 'exageration',
        minVisibleZoom: 'min_visible_zoom',
        maxVisibleZoom: 'max_visible_zoom'
    };
    function optionLabel(name: string) {
        return OPTION_LABELS[name] ? lc(OPTION_LABELS[name]) : name;
    }

    type OptionStore = Writable<any> & { reset: () => void };
    const customLayers = getMapContext().mapModule('customLayers');
    // after a reset to the style, the layer only has the style's value once it has drawn
    const STYLE_SETTLE_DELAY = 700;
    let settleTimer: ReturnType<typeof setTimeout>;
    onDestroy(() => clearTimeout(settleTimer));

    // the woven layer's option is the style's until the user sets it
    const isStyleDriven = (option: LayerOption) => !!option.styleParameter && item.layer !== item.terrainLayer;

    function readOption(name: string, option: LayerOption) {
        // layer.get, not layer[k]: a surface handle has no JS properties
        const value = option.read ? option.read(item.layer) : item.layer.get(name);
        const transformed = option.transformBack ? option.transformBack(value) : value;
        // on the slider's grid: an off-step style value would be written back as an override on open
        const factor = option.step < 1 ? Math.round(1 / option.step) : 1;
        const readValue = typeof transformed === 'number' && option.step ? Math.round(transformed * factor) / factor : transformed;
        // a row built on NaN would throw in the native slider
        return readValue === undefined || readValue === null || (typeof readValue === 'number' && !isFinite(readValue)) ? option.default : readValue;
    }
    function persistOption(name: string, option: LayerOption, value) {
        const key = `${item.name}_${name}`;
        if (value === option.default && !isStyleDriven(option)) {
            ApplicationSettings.remove(key);
        } else if (typeof value === 'boolean') {
            ApplicationSettings.setBoolean(key, value);
        } else if (typeof value === 'string') {
            ApplicationSettings.setString(key, value);
        } else {
            ApplicationSettings.setNumber(key, value);
        }
    }
    // the same shape as a `settingsStore`, so the shared setting rows can reset it
    function createOptionStore(name: string, option: LayerOption): OptionStore {
        const store = writable(readOption(name, option));
        let silent = true;
        store.subscribe((value) => {
            if (!silent) {
                persistOption(name, option, value);
                customLayers.applyLayerOption(item, name, option, value);
            }
        });
        silent = false;
        function setSilently(value) {
            silent = true;
            store.set(value);
            silent = false;
        }
        return {
            subscribe: store.subscribe,
            set: store.set,
            update: store.update,
            reset() {
                customLayers.resetLayerOption(item, name);
                if (isStyleDriven(option)) {
                    clearTimeout(settleTimer);
                    settleTimer = setTimeout(() => setSilently(readOption(name, option)), STYLE_SETTLE_DELAY);
                } else {
                    setSilently(option.default);
                }
            }
        };
    }

    const optionRows = Object.entries(item.options || {}).map(([name, option]) => ({ name, option, store: createOptionStore(name, option) }));
    const renderingOptions = optionRows.filter(({ option }) => option.type !== 'color');
    const colorOptions = optionRows.filter(({ option }) => option.type === 'color');

    function optionChoices(option: LayerOption) {
        return option.values.map((value) => ({ value, title: value.toLowerCase() }));
    }
    function optionFormat(name: string, option: LayerOption) {
        if (name === 'illuminationDirection') {
            return (value: number) => `${Math.round(value)}°`;
        }
        return option.step < 1 ? (value: number) => value.toFixed(2) : null;
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
</script>

<gesturerootview class="bottomsheet" {...$$restProps} height={420} rows="auto,auto,*,auto">
    <PanelHeader icon={item.imagery ? 'mdi-satellite-variant' : 'mdi-tune-variant'} subtitle={cacheSize} title={layerTitle(item)} />
    <wraplayout padding="0 12" row={1}>
        {#if item.imagery}
            <Pill icon="mdi-swap-horizontal" label={lc('change_source')} on:tap={() => handleAction('change_source')} />
        {/if}
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
            {#if renderingOptions.length}
                <label class="sectionHeader" text={lc('rendering')} />
            {/if}
            {#each renderingOptions as { name, option, store } (name)}
                {#if option.type === 'enum'}
                    <StoreSegment options={optionChoices(option)} {store} title={optionLabel(name)} />
                {:else if option.type === 'switch'}
                    <StoreSwitch {store} title={optionLabel(name)} />
                {:else}
                    <StoreSlider format={optionFormat(name, option)} max={option.max} min={option.min} step={option.step ?? 0.01} {store} title={optionLabel(name)} />
                {/if}
            {/each}
            {#if colorOptions.length}
                <label class="sectionHeader" text={lc('colors')} />
            {/if}
            {#each colorOptions as { name, store } (name)}
                <StoreColor {store} title={optionLabel(name)} />
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
