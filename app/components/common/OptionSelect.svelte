<svelte:options accessors />

<script context="module" lang="ts">
    import { CheckBox } from '@nativescript-community/ui-checkbox';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { openFilePicker } from '@nativescript-community/ui-document-picker';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { TextField } from '@nativescript-community/ui-material-textfield';
    import { EventData, File, ObservableArray, Utils, View } from '@nativescript/core';
    import { debounce } from '@nativescript/core/utils';
    import { onDestroy } from 'svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import IconButton from '~/components/common/IconButton.svelte';
    import { ListItem as IListItem } from '~/components/common/ListItem';
    import ListItem from '~/components/common/ListItem.svelte';
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';
    import Pill from '~/components/common/Pill.svelte';
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import { lc } from '~/helpers/locale';
    import { colors, fontScale, fontScaleMaxed, fonts } from '~/variables';
    export interface OptionType extends IListItem {
        subtitle?: string;
        isPick?: boolean;
        boxType?: string;
        type?: string;
        [k: string]: any;
    }
</script>

<script lang="ts">
    export let title: string = null;
    /** Toggle pills above the list, each `{ id, icon, label, selected }`; a tap goes to `onToggle`. */
    export let toggles: { id: string; icon: string; label: string; selected: boolean }[] = null;
    export let onToggle: (toggle) => void = null;
    export let titleIcon: string = null;
    export let showFilter = false;
    export let showBorders = false;
    export let backgroundColor = null;
    /** The panel look, following the theme while open (a menu can toggle dark mode). */
    export let panel = false;
    export let borderRadius = 8;
    export let rowHeight = null;
    /** Height of an item of `type: 'separator'`: a hairline between two groups of items. */
    export let separatorHeight = 12;
    export let autofocus = false;
    export let estimatedItemSize = true;
    export let autoSize = false;
    export let isScrollEnabled = true;
    export let width: string | number = '*';
    export let containerColumns: string = '*';
    export let autoSizeListItem: boolean = false;
    export let fontWeight = 'normal';
    export let options: OptionType[] | ObservableArray<OptionType>;
    export let onClose = null;
    export let selectedIndex = -1;
    export let height: number | string = null;
    export let fontSize = 16;
    export let iconFontSize = 24;
    export let onlyOneSelected = false;
    export let currentlyCheckedItem = null;
    export let onCheckBox: (item, value, e) => void = null;
    export let onChange: (item, value, e) => void = null;
    export let onRightIconTap: (item, e) => void = null;
    export let onLongPress: (item, e) => void = null;

    export let titleProps: Partial<svelteNative.JSX.LabelAttributes> = {};
    export let titleHolderProps: Partial<svelteNative.JSX.StackLayoutAttributes> = {};
    export let subtitleProps: Partial<svelteNative.JSX.LabelAttributes> = {};
    export let templateProps: Partial<svelteNative.JSX.GridLayoutAttributes> & {
        [k: string]: Partial<svelteNative.JSX.ViewAttributes>;
    } = {};

    export let component = autoSizeListItem ? ListItemAutoSize : ListItem;
    let filteredOptions: OptionType[] | ObservableArray<OptionType> = null;
    let filter: string = null;

    $: ({ colorHairline, colorOnSurface, colorOnSurfaceVariant, colorOutline, colorPanel, colorPrimary, colorSurfaceFill } = $colors);

    function updateFiltered(filter) {
        if (filter) {
            filteredOptions = options.filter((d) => (d.name || d.title).indexOf(filter) !== -1);
        } else {
            filteredOptions = options;
        }
    }
    const updateFilteredDebounce = debounce(updateFiltered, 500);
    updateFiltered(filter);
    $: updateFilteredDebounce(filter);

    function close(value?: OptionType) {
        (onClose || closeBottomSheet)(value);
    }

    let checkboxTapTimer;
    function clearCheckboxTimer() {
        if (checkboxTapTimer) {
            clearTimeout(checkboxTapTimer);
            checkboxTapTimer = null;
        }
    }
    async function onRightTap(item: OptionType, event) {
        onRightIconTap?.(item, event);
    }
    async function onTap(item: OptionType, event) {
        if (item.isPick) {
            try {
                const result = await openFilePicker({
                    extensions: ['file/*'],
                    multipleSelection: false,
                    pickerMode: 0,
                    forceSAF: true
                });
                if (File.exists(result.files[0])) {
                    const file = File.fromPath(result.files[0]);
                    close({ name: file.name, data: { url: file.path }, isPick: true });
                } else {
                    close(null);
                }
            } catch (err) {
                close(null);
            }
        } else if (item.type === 'checkbox' || item.type === 'switch') {
            // timeout: a tap directly on the checkbox would otherwise fire twice
            const checkboxView: CheckBox = ((event.object as View).parent as View).getViewById('checkbox');
            clearCheckboxTimer();
            checkboxTapTimer = setTimeout(() => {
                checkboxView.checked = !checkboxView.checked;
            }, 10);
        } else {
            close(item);
        }
    }
    let ignoreNextOnCheckBoxChange = false;
    function onCheckedChanged(item, event) {
        // DEV_LOG && console.log('onCheckedChanged', event.value, ignoreNextOnCheckBoxChange);
        clearCheckboxTimer();
        if (ignoreNextOnCheckBoxChange) {
            ignoreNextOnCheckBoxChange = false;
            return;
        }
        ignoreNextOnCheckBoxChange = true;
        if (onlyOneSelected && options instanceof ObservableArray) {
            if (event.value) {
                const oldSelected = currentlyCheckedItem;
                if (oldSelected === item) {
                    ignoreNextOnCheckBoxChange = false;
                    return;
                }
                DEV_LOG && console.log('onlyOneSelected', oldSelected);
                item.value = true;
                currentlyCheckedItem = item;
                if (oldSelected) {
                    const index = options.indexOf(oldSelected);
                    DEV_LOG && console.log('onlyOneSelected1', index);
                    if (index >= 0) {
                        oldSelected.value = false;
                        options.setItem(index, oldSelected);
                    }
                }
                options.setItem(options.indexOf(currentlyCheckedItem), currentlyCheckedItem);
            } else {
                // we dont allow to have none selected
                ignoreNextOnCheckBoxChange = false;
                const checkboxView: CheckBox = ((event.object as View).parent as View).getViewById('checkbox');
                checkboxView.checked = true;
                return;
            }
        }
        onCheckBox?.(item, event.value, event);
        ignoreNextOnCheckBoxChange = false;
    }
    onDestroy(() => {
        blurTextField();
    });
    function onTextFieldLoaded(event: EventData) {
        setTimeout(() => {
            if (autofocus) {
                (event.object as TextField).requestFocus();
            } else {
                (event.object as TextField).clearFocus();
            }
        }, 0);
    }
    function blurTextField() {
        Utils.dismissSoftInput();
    }

    function itemTemplateSelector(item) {
        if (item.type) {
            return item.type;
        }
        if (autoSizeListItem && item.icon) {
            return 'lefticon';
        }
        if (item.rightIcon) {
            return 'righticon';
        }
        return 'default';
    }
    function onCollectionLoaded(event: EventData) {
        if (event.object instanceof CollectionView) {
            event.object.setTemplateRowHeight('separator', separatorHeight);
        }
    }
    function onDataPopulated(event) {
        if (selectedIndex !== undefined) {
            if (onlyOneSelected) {
                currentlyCheckedItem = options instanceof ObservableArray ? options.getItem(selectedIndex) : options[selectedIndex];
            }
            if (selectedIndex > 0) {
                event.object.scrollToIndex(selectedIndex, false);
            }
        }
    }
</script>

<gesturerootview columns={containerColumns} rows="auto">
    <gridlayout
        backgroundColor={panel ? colorPanel : backgroundColor}
        {borderRadius}
        columns={`${width}`}
        {height}
        rows="auto,auto,*"
        {...panel ? { borderColor: colorHairline, borderWidth: 1 } : {}}
        {...$$restProps}>
        {#if title}
            <PanelHeader icon={titleIcon} padding="16 8 4 20" {title} />
        {/if}
        {#if showFilter}
            <!-- the design's search field: a filled rounded bar with its icon, no outline -->
            <gridlayout backgroundColor={colorSurfaceFill} borderRadius={22} columns="auto,*,auto" height={44} margin="4 16 8 16" row={1}>
                <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={20} padding="0 4 0 14" text="mdi-magnify" verticalAlignment="middle" />
                <textfield
                    autocapitalizationType="none"
                    backgroundColor="transparent"
                    col={1}
                    floating={false}
                    hint={lc('search')}
                    padding="0 4"
                    placeholder={lc('search')}
                    returnKeyType="search"
                    text={filter}
                    variant="none"
                    verticalTextAlignment="center"
                    on:loaded={onTextFieldLoaded}
                    on:returnPress={blurTextField}
                    on:textChange={(e) => (filter = e['value'])} />

                <IconButton
                    col={2}
                    color={colorOnSurfaceVariant}
                    isVisible={!!filter?.length}
                    size={40}
                    text="mdi-close"
                    verticalAlignment="middle"
                    on:tap={() => {
                        blurTextField();
                        filter = null;
                    }} />
            </gridlayout>
        {/if}
        {#if toggles?.length}
            <gridlayout borderBottomColor={colorHairline} borderBottomWidth={1} columns={toggles.map(() => '*').join(',')} padding="6 4 8 4" row={1}>
                {#each toggles as toggle, index}
                    <Pill
                        col={index}
                        horizontalAlignment="stretch"
                        icon={toggle.icon}
                        label={toggle.label}
                        selected={toggle.selected}
                        on:tap={() => {
                            toggle.selected = !toggle.selected;
                            toggles = toggles;
                            onToggle?.(toggle);
                        }} />
                {/each}
            </gridlayout>
        {/if}
        <collectionview
            {autoSize}
            {estimatedItemSize}
            {isScrollEnabled}
            {itemTemplateSelector}
            items={filteredOptions}
            row={2}
            {rowHeight}
            on:dataPopulated={onDataPopulated}
            on:loaded={onCollectionLoaded}
            ios:autoReloadItemOnLayout={true}
            ios:contentInsetAdjustmentBehavior={2}>
            <Template key="checkbox" let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    columns="auto,*,auto"
                    {fontSize}
                    {fontWeight}
                    iconFontSize={item.iconFontSize || iconFontSize}
                    {item}
                    mainCol={1}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    {titleHolderProps}
                    {titleProps}
                    {...autoSizeListItem && item.icon ? { icon: item.icon, iconFontFamily: item.iconFontFamily } : {}}
                    {...templateProps}
                    on:tap={(event) => onTap(item, event)}>
                    <checkbox
                        id="checkbox"
                        boxType={item.boxType}
                        checked={item.value}
                        col={item.boxType === 'circle' ? 0 : 2}
                        verticalAlignment="center"
                        on:checkedChange={(e) => onCheckedChanged(item, e)} />
                </svelte:component>
            </Template>
            <Template key="switch" let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    columns="auto,*,auto"
                    {fontSize}
                    {fontWeight}
                    iconFontSize={item.iconFontSize || iconFontSize}
                    {item}
                    mainCol={1}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    {titleHolderProps}
                    {titleProps}
                    {...autoSizeListItem && item.icon ? { icon: item.icon, iconFontFamily: item.iconFontFamily } : {}}
                    {...templateProps}
                    on:tap={(event) => onTap(item, event)}>
                    <switch id="checkbox" checked={item.value} col={2} horizontalAlignment="right" marginLeft={10} verticalAlignment="center" on:checkedChange={(e) => onCheckedChanged(item, e)} />
                </svelte:component>
            </Template>
            <Template key="righticon" let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    columns="*,auto"
                    {fontSize}
                    {fontWeight}
                    iconFontSize={item.iconFontSize || iconFontSize}
                    {item}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    {titleHolderProps}
                    {titleProps}
                    {...templateProps}
                    on:tap={(event) => onTap(item, event)}>
                    <mdbutton class="icon-btn" col={1} text={item.rightIcon} variant="text" on:tap={(event) => onRightTap(item, event)} />
                </svelte:component>
            </Template>
            <Template key="lefticon" let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    columns="auto,*"
                    {fontSize}
                    {fontWeight}
                    {item}
                    mainCol={1}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    {titleHolderProps}
                    {titleProps}
                    {...templateProps}
                    on:tap={(event) => onTap(item, event)}>
                    <label
                        class="ignoreA11yFontScale"
                        color={item.color || colorOnSurface}
                        fontFamily={$fonts.mdi}
                        fontSize={(item.iconFontSize || iconFontSize) * $fontScaleMaxed}
                        paddingLeft="8"
                        text={item.icon}
                        verticalAlignment="center"
                        width={iconFontSize * 2} />
                </svelte:component>
            </Template>
            <Template key="image" let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    columns="auto,*"
                    {fontSize}
                    {fontWeight}
                    iconFontSize={item.iconFontSize || iconFontSize}
                    {item}
                    mainCol={1}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    title={item.name}
                    {titleHolderProps}
                    {titleProps}
                    {...templateProps}
                    on:tap={(event) => onTap(item, event)}>
                    <!-- a fixed thumbnail tile, a map glyph standing in when there is no preview -->
                    <gridlayout backgroundColor={colorSurfaceFill} borderRadius={10} height={48} marginRight={12} verticalAlignment="middle" width={48}>
                        <label color={colorPrimary} fontFamily={$fonts.mdi} fontSize={22} text="mdi-map-outline" textAlignment="center" verticalAlignment="middle" />
                        <image headers={item.imageHeaders} src={item.image} stretch="aspectFill" visibility={item.image ? 'visible' : 'collapse'} />
                    </gridlayout>
                </svelte:component>
            </Template>
            <Template key="separator">
                <gridlayout>
                    <absolutelayout backgroundColor={colorHairline} height={1} margin="0 12" verticalAlignment="middle" />
                </gridlayout>
            </Template>
            <Template key="slider" let:item>
                <SettingsSlider {fontSize} {...item} onChange={(value, event) => (item.onChange || onChange)?.(item, value, event)} />
            </Template>
            <Template let:item>
                <svelte:component
                    this={component}
                    {borderRadius}
                    {fontSize}
                    {fontWeight}
                    iconFontSize={item.iconFontSize || iconFontSize}
                    {item}
                    {onLongPress}
                    showBottomLine={showBorders}
                    {subtitleProps}
                    {titleHolderProps}
                    {titleProps}
                    {...templateProps}
                    on:rightTap={(event) => onRightTap(item, event)}
                    on:tap={(event) => onTap(item, event)}>
                </svelte:component>
            </Template>
        </collectionview>
    </gridlayout>
</gesturerootview>
