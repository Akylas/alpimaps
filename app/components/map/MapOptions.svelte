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
    import StoreValue from '~/components/common/StoreValue.svelte';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import CustomLayersModule from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import {      
        pitchEnabled,
        preloading,
        projectionModeSpherical,
        rotateEnabled,      
        showSlopePercentages,
        showItemsLayer,
        nutiProps
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
                                } else if (item.nutiProps) {
                                    item.nutiProps[item.key] = value;
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
            try {
                newItems.push(...nutiProps.getKeys().map(key => nutiProps.getSettingsOptions(key)).filter(s=>!s.icon));
            } catch(error){
                showError(error);
            }         
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
            if (item.store) {
                item.store.set(value);
            } else if (item.nutiProps) {
                item.nutiProps[item.key] = value;
            } else if (item.mapStore) {
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
    
    const nutiIconParams = ['contours', 'buildings']
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
        {#each nutiIconParams.map(key=>({...nutiProps.getSettingsOptions(key), id:key})).filter(s=>s.visible?.(customLayers) ?? true) as option}
            <StoreValue store={option.store} let:value> 
              <IconButton isSelected={value} text={option.icon} toggable={true} tooltip={option.title} on:tap={() => option.store.set(!value)} onLongPress={option.onLongPress}/>
            </StoreValue>
        {/each}
        {#if !!customLayers?.hasTerrain}
            <IconButton isSelected={$showSlopePercentages} text="mdi-signal" toggable={true} tooltip={lc('show_percentage_slopes')} on:tap={() => showSlopePercentages.set(!$showSlopePercentages)} />
        {/if}
        <IconButton isSelected={$projectionModeSpherical} text="mdi-globe-model" toggable={true} tooltip={lc('globe_mode')} on:tap={() => projectionModeSpherical.set(!$projectionModeSpherical)} />
        <IconButton isSelected={$rotateEnabled} text="mdi-rotate-3d-variant" toggable={true} tooltip={lc('map_rotation')} on:tap={() => rotateEnabled.set(!$rotateEnabled)} />
        <IconButton isSelected={$pitchEnabled} text="mdi-rotate-orbit" toggable={true} tooltip={lc('map_pitch')} on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
        <IconButton isSelected={$preloading} text="mdi-map-clock" toggable={true} tooltip={lc('preloading')} on:tap={() => preloading.set(!$preloading)} />
        <IconButton isSelected={$showItemsLayer} text="mdi-map-marker-off-outline" toggable={true} tooltip={lc('show_items_routes')} on:tap={() => showItemsLayer.set(!$showItemsLayer)} />
    </stacklayout>
</gesturerootview>
