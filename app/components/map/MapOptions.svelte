<script context="module" lang="ts">
    import { l, lc } from '@nativescript-community/l';
    import { CheckBox } from '@nativescript-community/ui-checkbox';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { ApplicationSettings, Color, ObservableArray, Utils, View } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { Writable } from 'svelte/store';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import {
        cityMinZoom,
        forestPatternZoom,
        rockPatternZoom,
        scrubPatternZoom,
        screePatternZoom,
        contourLinesOpacity,
        emphasisDrinkingWater,
        emphasisRails,
        mapFontScale,
        pitchEnabled,
        preloading,
        projectionModeSpherical,
        rotateEnabled,
        show3DBuildings,
        showContourLines,
        showSubBoundaries,
        showPolygonsBorder,
        showRoadShields,
        showRouteShields,
        showItemsLayer
    } from '~/stores/mapStore';
    import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
    import { showAlertOptionSelect, showSliderPopover } from '~/utils/ui';
    import { colors } from '~/variables';
    import IconButton from '../common/IconButton.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
    export interface MapOptionType {
        title: string;
        color?: Color | string;
        id: string;
        icon: string;
    }
</script>

<script lang="ts">
    let { colorOutlineVariant } = $colors;
    $: ({ colorOutlineVariant } = $colors);
    const customLayers: CustomLayersModule = getMapContext().mapModule('customLayers');
    let collectionView: NativeViewElementNode<CollectionViewWithSwipeMenu>;

    function getTitle(item) {
        switch (item.id) {
            case 'token':
                return lc(item.token);
            default:
                return item.title;
        }
    }
    function getSubtitle(item) {
        return typeof item.description === 'function' ? item.description(item) : item.description;
    }
    function updateItem(item, key = 'key') {
        const index = items.findIndex((it) => it[key] === item[key]);
        if (index !== -1) {
            items.setItem(index, item);
        }
    }
    let checkboxTapTimer;
    async function onTap(item, event) {
        try {
            if (item.type === 'checkbox' || item.type === 'switch') {
                // we dont want duplicate events so let s timeout and see if we clicking diretly on the checkbox
                const checkboxView: CheckBox = ((event.object as View).parent as View).getViewById('checkbox');
                checkboxTapTimer = setTimeout(() => {
                    checkboxView.checked = !checkboxView.checked;
                }, 10);
                return;
            }
            switch (item.id) {
                case 'setting': {
                    if (item.type === 'prompt') {
                        const result = await prompt({
                            title: getTitle(item),
                            message: getSubtitle(item),
                            okButtonText: l('save'),
                            cancelButtonText: l('cancel'),
                            autoFocus: true,
                            defaultText: ApplicationSettings.getNumber(item.key, item.default) + ''
                        });
                        Utils.dismissSoftInput();
                        if (result && !!result.result && result.text.length > 0) {
                            if (item.valueType === 'string') {
                                ApplicationSettings.setString(item.key, result.text);
                            } else {
                                ApplicationSettings.setNumber(item.key, parseInt(result.text, 10));
                            }
                            updateItem(item);
                        }
                    } else if (item.type === 'slider') {
                        await showSliderPopover({
                            anchor: event.object,
                            value: item.currentValue(),
                            ...item,
                            onChange(value) {
                                if (item.transformValue) {
                                    value = item.transformValue(value, item);
                                } else {
                                    value = Math.round(value / item.step) * item.step;
                                }
                                if (item.mapStore) {
                                    (item.mapStore as Writable<boolean>).set(value);
                                } else {
                                    if (item.valueType === 'string') {
                                        ApplicationSettings.setString(item.key, value + '');
                                    } else {
                                        ApplicationSettings.setNumber(item.key, value);
                                    }
                                }
                                updateItem(item);
                            }
                        });
                    } else {
                        const currentValue = ApplicationSettings.getNumber(item.key, item.default);
                        let selectedIndex = -1;
                        const options = item.values.map((k, index) => {
                            const selected = currentValue === k.value;
                            if (selected) {
                                selectedIndex = index;
                            }
                            return {
                                name: k.title || k.name,
                                data: k.value,
                                boxType: 'circle',
                                type: 'checkbox',
                                value: selected
                            };
                        });
                        const result = await showAlertOptionSelect(
                            {
                                height: Math.min(options.length * 56, ALERT_OPTION_MAX_HEIGHT),
                                rowHeight: 56,
                                selectedIndex,
                                options
                            },
                            {
                                title: item.title
                            }
                        );
                        if (result?.data !== undefined) {
                            ApplicationSettings.setNumber(item.key, result.data);
                            updateItem(item);
                        }
                    }

                    break;
                }
            }
        } catch (error) {
            showError(error);
        }
    }
    let items: ObservableArray<any>;
    function refresh() {
        const newItems = [];
        if (customLayers.hasLocalData) {
            newItems.push(
                {
                    id: 'setting',
                    key: 'mapFontScale',
                    mapStore: mapFontScale,
                    min: 0.5,
                    max: 4,
                    step: null,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value.toFixed(2),
                    title: lc('map_font_scale'),
                    description: lc('map_font_scale_desc'),
                    type: 'slider',
                    rightValue: () => $mapFontScale.toFixed(2),
                    currentValue: () => $mapFontScale
                },
                {
                    id: 'setting',
                    mapStore: contourLinesOpacity,
                    key: 'contourLinesOpacity',
                    min: 0,
                    max: 1,
                    step: null,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value.toFixed(2),
                    title: lc('contour_lines_opacity'),
                    description: lc('contour_lines_opacity_desc'),
                    type: 'slider',
                    rightValue: () => $contourLinesOpacity.toFixed(2),
                    currentValue: () => $contourLinesOpacity
                },
                {
                    id: 'setting',
                    mapStore: cityMinZoom,
                    key: 'cityMinZoom',
                    min: 0,
                    max: 24,
                    step: 1,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value,
                    title: lc('city_min_zoom'),
                    description: lc('city_min_zoom_desc'),
                    type: 'slider',
                    rightValue: () => $cityMinZoom,
                    currentValue: () => Math.max(0, $cityMinZoom)
                },
                {
                    id: 'setting',
                    mapStore: forestPatternZoom,
                    key: 'forestPatternZoom',
                    min: 0,
                    max: 24,
                    step: 1,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value,
                    title: lc('forest_pattern_zoom'),
                    description: lc('forest_pattern_zoom_desc'),
                    type: 'slider',
                    rightValue: () => $forestPatternZoom,
                    currentValue: () => Math.max(0, $forestPatternZoom)
                },
                {
                    id: 'setting',
                    mapStore: rockPatternZoom,
                    key: 'rockPatternZoom',
                    min: 0,
                    max: 24,
                    step: 1,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value,
                    title: lc('rock_pattern_zoom'),
                    description: lc('rock_pattern_zoom_desc'),
                    type: 'slider',
                    rightValue: () => $rockPatternZoom,
                    currentValue: () => Math.max(0, $rockPatternZoom)
                },
                {
                    id: 'setting',
                    mapStore: screePatternZoom,
                    key: 'screePatternZoom',
                    min: 0,
                    max: 24,
                    step: 1,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value,
                    title: lc('scree_pattern_zoom'),
                    description: lc('scree_pattern_zoom_desc'),
                    type: 'slider',
                    rightValue: () => $screePatternZoom,
                    currentValue: () => Math.max(0, $screePatternZoom)
                },
                {
                    id: 'setting',
                    mapStore: scrubPatternZoom,
                    key: 'scrubPatternZoom',
                    min: 0,
                    max: 24,
                    step: 1,
                    formatter: (value) => value,
                    transformValue: (value, item) => value,
                    valueFormatter: (value, item) => value,
                    title: lc('scrub_pattern_zoom'),
                    description: lc('scrub_pattern_zoom_desc'),
                    type: 'slider',
                    rightValue: () => $scrubPatternZoom,
                    currentValue: () => Math.max(0, $scrubPatternZoom)
                },
                {
                    mapStore: showSubBoundaries,
                    type: 'switch',
                    value: $showSubBoundaries,
                    title: lc('show_sub_boundaries')
                },
                {
                    mapStore: emphasisDrinkingWater,
                    type: 'switch',
                    value: $emphasisDrinkingWater,
                    title: lc('emphasis_drinking_water')
                },
                {
                    mapStore: emphasisRails,
                    type: 'switch',
                    value: $emphasisRails,
                    title: lc('emphasis_rail_tracks')
                },
                {
                    mapStore: showPolygonsBorder,
                    type: 'switch',
                    value: $showPolygonsBorder,
                    title: lc('show_polygone_border')
                },
                {
                    mapStore: showRoadShields,
                    type: 'switch',
                    value: $showRoadShields,
                    title: lc('show_road_shields')
                },
                {
                    mapStore: showRouteShields,
                    type: 'switch',
                    value: $showRouteShields,
                    title: lc('show_route_shields')
                }
            );

        }
        items = new ObservableArray(newItems);
    }
    onServiceLoaded((handler: GeoHandler) => {
        refresh();
    });

    function onCheckBox(item, event) {
        if (item.value === event.value) {
            return;
        }
        const value = event.value;
        item.value = value;
        if (checkboxTapTimer) {
            clearTimeout(checkboxTapTimer);
            checkboxTapTimer = null;
        }
        try {
            if (item.mapStore) {
                (item.mapStore as Writable<boolean>).set(value);
            } else {
                ApplicationSettings.setBoolean(item.key || item.id, value);
            }
        } catch (error) {
            console.error(error, error.stack);
        }
    }
    function itemTemplateSelector(item, index, items) {
        if (item.type === 'prompt') {
            return 'default';
        }

        if (item.icon) {
            return 'leftIcon';
        }
        return item.type || 'default';
    }
</script>

<gesturerootview height={350} rows="auto,*">
    <collectionview bind:this={collectionView} {itemTemplateSelector} {items} row={1} ios:contentInsetAdjustmentBehavior={2}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <ListItemAutoSize item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }} leftIcon={item.icon} on:tap={(event) => onTap(item, event)}>
                <switch id="checkbox" checked={item.value} col={1} on:checkedChange={(e) => onCheckBox(item, e)} />
            </ListItemAutoSize>
        </Template>
        <Template let:item>
            <ListItemAutoSize item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }} rightValue={item.rightValue} showBottomLine={false} on:tap={(event) => onTap(item, event)}
            ></ListItemAutoSize>
        </Template>
    </collectionview>
    <stacklayout borderBottomColor={colorOutlineVariant} borderBottomWidth={1} orientation="horizontal">
        {#if !!customLayers?.hasLocalData}
            <IconButton isSelected={$showContourLines} text="mdi-bullseye" toggable={true} tooltip={lc('show_contour_lines')} on:tap={() => showContourLines.set(!$showContourLines)} />
        {/if}
        {#if !!customLayers?.hasLocalData}
            <IconButton isSelected={$show3DBuildings} text="mdi-domain" toggable={true} tooltip={lc('buildings_3d')} on:tap={() => show3DBuildings.set(!$show3DBuildings)} />
        {/if}
        <IconButton isSelected={$projectionModeSpherical} text="mdi-globe-model" toggable={true} tooltip={lc('globe_mode')} on:tap={() => projectionModeSpherical.set(!$projectionModeSpherical)} />
        <IconButton isSelected={$rotateEnabled} text="mdi-rotate-3d-variant" toggable={true} tooltip={lc('map_rotation')} on:tap={() => rotateEnabled.set(!$rotateEnabled)} />
        <IconButton isSelected={$pitchEnabled} text="mdi-rotate-orbit" toggable={true} tooltip={lc('map_pitch')} on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
        <IconButton isSelected={$preloading} text="mdi-map-clock" toggable={true} tooltip={lc('preloading')} on:tap={() => preloading.set(!$preloading)} />
        <IconButton isSelected={$showItemsLayer} text="mdi-locations-outline" toggable={true} tooltip={lc('show_items_routes')} on:tap={() => showItemsLayer.set(!$showItemsLayer)} />
    </stacklayout>
</gesturerootview>
