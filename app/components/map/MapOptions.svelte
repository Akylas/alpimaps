<script context="module" lang="ts">
    import { l, lc } from '@nativescript-community/l';
    import { CheckBox } from '@nativescript-community/ui-checkbox';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { prompt } from '@nativescript-community/ui-material-dialogs';
    import { ApplicationSettings, Color, ObservableArray, Utils, View } from '@nativescript/core';
    import { showError } from '@shared/utils/showError';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { Writable, get } from 'svelte/store';
    import StoreValue from '~/components/common/StoreValue.svelte';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import CustomLayersModule, { mapCapabilities } from '~/mapModules/CustomLayersModule';
    import { getMapContext } from '~/mapModules/MapModule';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { innerNutiProps, layerProps, nutiProps, pitchEnabled, preloading, projectionModeSpherical, rotateEnabled, showItemsLayer, styleHasParameter, styleParameterKeys, styleParameterValues } from '~/stores/mapStore';
    import { ALERT_OPTION_MAX_HEIGHT } from '~/utils/constants';
    import { showAlertOptionSelect, showSliderPopover } from '~/utils/ui';
    import Pill from '../common/Pill.svelte';
    import ListItemAutoSize from '../common/ListItemAutoSize.svelte';
    import PanelHeader from '../common/PanelHeader.svelte';
    export interface MapOptionType {
        title: string;
        color?: Color | string;
        id: string;
        icon: string;
    }
</script>

<script lang="ts">
    import SettingsSwitch from '../settings/SettingsSwitch.svelte';

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
        const description = typeof item.description === 'function' ? item.description(item) : item.description;
        if (!item.styleOwned) {
            return description;
        }
        const state = lc(item.overridden ? 'style_option_overridden' : 'style_option_default');
        return description ? `${description}\n${state}` : state;
    }
    // an option left to the style goes back to it
    // on every switch: a recycled row keeps the listener its first item got
    function resetToStyle(item) {
        if (!item.styleOwned) {
            return;
        }
        // the store, not the template's item: that one was drawn before the switch moved
        const value = item.nutiProps.getProps(item.key).value;
        if (value != null && value !== -1) {
            item.nutiProps[item.key] = null;
            refresh();
        }
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
                        DEV_LOG && console.log('showSliderPopover', item.title, item.icon, item.currentValue(), item.defaultValue);
                        await showSliderPopover({
                            anchor: event.object,
                            value: item.currentValue(),
                            ...item,
                            onChange(value) {
                                DEV_LOG && console.log('onChange1', value, !!item.nutiProps);
                                if (value !== null) {
                                    if (item.transformValue) {
                                        value = item.transformValue(value, item);
                                    } else {
                                        value = Math.round(value / item.step) * item.step;
                                    }
                                }
                                if (item.store) {
                                    item.store.set(value);
                                } else if (item.mapStore) {
                                    (item.mapStore as Writable<any>).set(value);
                                } else if (item.nutiProps) {
                                    item.nutiProps[item.key] = value;
                                } else {
                                    if (value === null) {
                                        ApplicationSettings.remove(item.key);
                                    } else {
                                        if (item.valueType === 'string') {
                                            ApplicationSettings.setString(item.key, value + '');
                                        } else {
                                            ApplicationSettings.setNumber(item.key, value);
                                        }
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
                                titleIcon: item.icon,
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
        // if (customLayers.hasLocalData) {
        try {
            newItems.push(
                ...nutiProps
                    .getKeys()
                    .filter((key) => styleHasParameter(get(styleParameterKeys), key))
                    .map((key) => nutiProps.getSettingsOptions(key))
                    .filter((s) => s.showAsIcon !== true)
            );
            newItems.push(
                ...innerNutiProps
                    .getKeys()
                    .map((key) => innerNutiProps.getSettingsOptions(key))
                    .filter((s) => s.showAsIcon !== true)
            );
        } catch (error) {
            showError(error);
        }
        // }
        items = new ObservableArray(newItems);
    }
    onServiceLoaded((handler: GeoHandler) => {
        refresh();
    });
    // another style, other parameters
    $: ($styleParameterKeys, $styleParameterValues, items && refresh());

    function onCheckBox(item, value, event) {
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
        return item.type || 'default';
    }

    const nutiIconParams = ['contours', 'buildings'] as const;
    const layerIconParams = ['showSlopePercentages'] as const;
</script>

<gesturerootview class="bottomsheet" height={420} rows="auto,auto,*">
    <PanelHeader icon="mdi-map-outline" title={lc('map')} />
    <collectionview bind:this={collectionView} {itemTemplateSelector} {items} row={2} ios:contentInsetAdjustmentBehavior={2}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <SettingsSwitch
                item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }}
                {onCheckBox}
                onLongPress={resetToStyle}
                on:tap={(event) => onTap(item, event)} />
        </Template>
        <Template let:item>
            <ListItemAutoSize
                columns="auto,*,auto"
                icon={item.icon}
                item={{ ...item, title: getTitle(item), subtitle: getSubtitle(item) }}
                mainCol={1}
                rightValue={item.rightValue}
                showBottomLine={false}
                on:tap={(event) => onTap(item, event)} />
        </Template>
    </collectionview>

    <!-- the layers sheet's toggles: short labelled pills, tinted when on. Two rows at most, scrolling
         sideways, so the settings list keeps its room -->
    <scrollview orientation="horizontal" row={1} scrollBarIndicatorVisible={false}>
        <wraplayout height={100} orientation="vertical" padding="0 12 0 12">
            {#each nutiIconParams
                .filter((key) => styleHasParameter($styleParameterKeys, key))
                .map((key) => ({ ...nutiProps.getSettingsOptions(key), id: key }))
                .filter((s) => s.visible?.($mapCapabilities) ?? true) as option}
                <StoreValue store={option.store} let:value>
                    <Pill icon={option.icon} label={lc(option.id)} selected={value} on:tap={() => option.store.set(!value)} on:longPress={(event) => option.onLongPress?.(event)} />
                </StoreValue>
            {/each}
            {#each layerIconParams.map((key) => ({ ...layerProps.getSettingsOptions(key), id: key })).filter((s) => s.visible?.($mapCapabilities) ?? true) as option}
                <StoreValue store={option.store} let:value>
                    <Pill icon={option.icon} label={lc('slopes')} selected={value} on:tap={() => option.store.set(!value)} on:longPress={(event) => option.onLongPress?.(event)} />
                </StoreValue>
            {/each}
            <Pill icon="mdi-globe-model" label={lc('globe')} selected={$projectionModeSpherical} on:tap={() => projectionModeSpherical.set(!$projectionModeSpherical)} />
            <Pill icon="mdi-rotate-3d-variant" label={lc('rotation')} selected={$rotateEnabled} on:tap={() => rotateEnabled.set(!$rotateEnabled)} />
            <Pill icon="mdi-rotate-orbit" label={lc('pitch')} selected={$pitchEnabled} on:tap={() => pitchEnabled.set(!$pitchEnabled)} />
            <Pill icon="mdi-map-clock" label={lc('preload')} selected={$preloading} on:tap={() => preloading.set(!$preloading)} />
            <Pill icon="mdi-map-marker-multiple-outline" label={lc('items')} selected={$showItemsLayer} on:tap={() => showItemsLayer.set(!$showItemsLayer)} />
        </wraplayout>
    </scrollview>
</gesturerootview>
