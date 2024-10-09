<script context="module" lang="ts">
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { Align, Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { showSnack } from '~/utils/ui';
    import { VerticalPosition } from '@nativescript-community/ui-popover';
    import { AndroidActivityBackPressedEventData, Application, LayoutBase, NavigatedData, ObservableArray, Page, Utils, View } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { UNITS, convertElevation, convertValueToUnit, osmicon } from '~/helpers/formatter';
    import { convertDurationSeconds, lc, lu, onLanguageChanged } from '~/helpers/locale';
    import { onThemeChanged, theme } from '~/helpers/theme';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Group, Item } from '~/models/Item';
    import { isServiceStarted, onServiceStarted } from '~/services/BgService.common';
    import { showError } from '~/utils/showError';
    import { goBack, navigate } from '~/utils/svelte/ui';
    import { onBackButton } from '~/utils/ui';
    import { hideLoading, promptForGroup, showLoading, showPopoverMenu } from '~/utils/ui/index.common';
    import { colors, fonts, windowInset } from '~/variables';
    import BottomSheetInfoView from '../bottomsheet/BottomSheetInfoView.svelte';
    import CActionBar from '../common/CActionBar.svelte';
    import IconButton from '../common/IconButton.svelte';
    import SelectedIndicator from '../common/SelectedIndicator.svelte';
    type MapGroup = Group;
    type CollectionGroup = MapGroup & { type: 'group'; count: number; selected?: boolean; totalTime?: number; totalDistance?: number };
    type CollectionItem = Item & { selected?: boolean };
    type CollectionItemOrGroup = CollectionItem | CollectionGroup;

    const groupPaint = new Paint();
    groupPaint.textSize = 12;

    const iconPaint = new Paint();
    iconPaint.setTextAlign(Align.LEFT);
    iconPaint.textSize = 16;
    iconPaint.fontFamily = 'osm';
</script>

<script lang="ts">
    $: ({ colorBackground, colorOnSurface, colorSurfaceContainerHigh, colorOnSurfaceVariant, colorPrimary, colorOnPrimary, colorOutlineVariant, colorError } = $colors);
    $: ({ bottom: windowInsetBottom } = $windowInset);
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let items: ObservableArray<CollectionItemOrGroup>;
    let groupedItems: { [k: string]: CollectionItem[] };
    let groups: { [k: string]: MapGroup };
    let itemsCount = 0;
    let tabIndex = 0;
    let nbSelected = 0;
    const itemsModule = getMapContext().mapModule('items');
    let needsFirstRefresh = true;
    let ignoreRefresh = false;
    let navigatedTo = false;
    let loading = false;

    function onNavigatedTo(args: NavigatedData) {
        if (!args.isBackNavigation && !navigatedTo) {
            navigatedTo = true;
            if (isServiceStarted()) {
                refresh();
            }
        }
    }
    onServiceStarted(() => {
        if (navigatedTo && needsFirstRefresh) {
            refresh();
        }
    });

    function groupBy<T>(items: readonly T[], keyGetter: (item: T) => string) {
        const result = {};
        items.forEach((item) => {
            const key = keyGetter(item);
            result[key] = item;
        });
        return result;
    }
    function groupByArray<T>(items: T[], keyGetter: (item: T) => string[]) {
        const result = {};
        items.forEach((item) => {
            const keys = keyGetter(item) || ['none'];
            keys.forEach((key) => {
                const collection = result[key];
                if (!collection) {
                    result[key] = [item];
                } else {
                    collection.push(item);
                }
            });
        });
        return result;
    }

    function updateGroupItemData(groupItem: CollectionGroup, group?: MapGroup) {
        let totalDistance = 0;
        let totalTime = 0;
        let dplus = 0;
        let dmin = 0;
        const groupKey = groupItem.name || 'none';
        const subItems = groupedItems[groupKey];

        subItems.forEach((item: Item) => {
            const profile = item.profile;
            const itemProps = item.properties;
            const hasProfile = !!profile?.max;
            totalDistance += item.route?.totalDistance || (itemProps?.hasOwnProperty('distance') ? itemProps.distance * 1000 : 0);
            totalTime += item.route?.totalTime || 0;
            if (!hasProfile) {
                if (itemProps?.ascent > 0) {
                    dplus += itemProps.ascent;
                }
                if (itemProps?.descent > 0) {
                    dmin += itemProps.descent;
                }
            } else {
                const profile = item.profile;
                dplus += profile.dplus;
                dmin += profile.dmin;
            }
        });
        Object.assign(groupItem, { totalDistance, totalTime, dplus, dmin });
    }

    async function refresh() {
        if (ignoreRefresh || loading) {
            return;
        }
        const firstLoad = !!needsFirstRefresh;
        needsFirstRefresh = false;
        loading = true;
        // if itemslist is opened too fast the db might not be fully initialized
        itemsModule.onDbInit(async () => {
            try {
                nbSelected = 0;
                if (firstLoad) {
                    const result = await itemsModule.itemRepository.database.query(SqlQuery.createFromTemplateString`SELECT COUNT(*) FROM Items WHERE "route" IS NOT NULL`);
                    tabIndex = result[0]['COUNT(*)'] > 0 ? 0 : 1;
                }
                const searchArgs = {
                    where: tabIndex === 1 ? SqlQuery.createFromTemplateString`"route" IS NULL` : SqlQuery.createFromTemplateString`"route" IS NOT NULL`,
                    // postfix: Sq  lQuery.createFromTemplateString`i`
                    postfix: SqlQuery.createFromTemplateString`i
LEFT JOIN  (
   SELECT it.item_id AS id,group_concat(t.name) AS groups
   FROM   ItemsGroups it
   JOIN   Groups       t  ON t.id = it.group_id
   GROUP  BY it.item_id
   ) t USING (id)`
                };
                const sqlItems = (await itemsModule.itemRepository.searchItem(searchArgs)).map((i) => ({ ...i }));
                const oldGroups = groups;
                groups = groupBy<Group>(await itemsModule.groupsRepository.search(), (i) => i.name);
                if (!groups['none']) {
                    await itemsModule.groupsRepository.create({ id: Date.now() + '', name: 'none', onMap: 1, collapse: 0 });
                    groups['none'] = { name: 'none', onMap: 1, id: 'none', collapse: 0 };
                }
                // if (oldGroups) {
                //     Object.keys(oldGroups).forEach((k) => {
                //         if (groups[k]) {
                //             groups[k].collapse = oldGroups[k].collapse;
                //         }
                //     });
                // }
                groupedItems = groupByArray<Item>(sqlItems, (i) => i.groups);
                const groupsCount = Object.keys(groupedItems).length;
                const noneGroupItems: CollectionItem[] = groupsCount > 1 ? [] : groupedItems['none'] || [];
                if (groupsCount === 1) {
                    delete groupedItems['none'];
                }
                items = new ObservableArray(
                    Object.keys(groupedItems).reduce((acc, key) => {
                        const group = groups[key];
                        const subItems = groupedItems[key];
                        const onMap = subItems.some((i) => i.onMap === 1) ? 1 : 0;
                        const groupItem = { type: 'group', ...group, onMap, count: subItems.length } as CollectionGroup;
                        updateGroupItemData(groupItem, group);
                        acc.push(groupItem, ...(group.collapse ? [] : subItems));
                        return acc;
                    }, noneGroupItems as CollectionItemOrGroup[])
                );
                itemsCount = items.length;
            } catch (error) {
                showError(error);
            } finally {
                loading = false;
            }
        });
    }

    function switchGroupCollapsed(item: Group, event) {
        const groupKey = item.name || 'none';
        const collapse = (1 - groups[groupKey].collapse) as 0 | 1;
        if (collapse === groups[groupKey].collapse) {
            return;
        }
        groups[groupKey].collapse = collapse;
        itemsModule.groupsRepository.update(groups[groupKey], { collapse });
        let collapseButton = event.object as View;
        if (collapseButton instanceof LayoutBase) {
            collapseButton = collapseButton.getViewById('collapseButton');
        }
        collapseButton.animate({
            duration: 200,
            rotate: collapse ? 180 : 0
        });
        const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
        if (groupIndex >= 0) {
            const groupItem = items.getItem(groupIndex);
            (groupItem as CollectionGroup).collapse = collapse;
            items.setItem(groupIndex, groupItem);
            if (collapse) {
                items.splice(groupIndex + 1, groupedItems[groupKey].length);
            } else {
                items.splice(groupIndex + 1, 0, ...groupedItems[groupKey]);
            }
        }
    }
    async function switchGroupOnMap(item: Group, event) {
        try {
            await showLoading();
            ignoreRefresh = true;
            const groupKey = item.name || 'none';

            const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
            if (groupIndex >= 0) {
                const groupItem = items.getItem(groupIndex);
                const onMap = (1 - groupItem.onMap) as 0 | 1;
                groupItem.onMap = onMap;
                items.setItem(groupIndex, groupItem);
                const subItems = groupedItems[groupKey];
                const collapsed = (item as CollectionGroup).collapse;
                const groupCount = subItems.length;
                DEV_LOG && console.log('switchGroupOnMap', groupKey, groupIndex, onMap, groupCount);
                for (let j = 0; j < groupCount; j++) {
                    const subItem = subItems[j];
                    if (onMap) {
                        await itemsModule.showItem(subItem as Item);
                    } else {
                        await itemsModule.hideItem(subItem as Item);
                    }
                    subItem.onMap = onMap;
                    if (!collapsed) {
                        items.setItem(groupIndex + 1 + j, subItem);
                    }
                }
            }
        } catch (error) {
            showError(error);
        } finally {
            DEV_LOG && console.log('switchGroupOnMap done');
            ignoreRefresh = false;
            hideLoading();
        }
    }
    // async function refresh() {
    //     const sqlItems = await itemsModule.itemRepository.searchItem(tabIndex === 1 ? SqlQuery.createFromTemplateString`"route" IS NULL` : SqlQuery.createFromTemplateString`"route" IS NOT NULL`);
    //     for (let index = 0; index < sqlItems.length; index++) {
    //         await itemsModule.itemRepository.loadGroupsRelationship(sqlItems[index]);
    //     }
    //     items = new ObservableArray(sqlItems);
    //     itemsCount = items.length;
    // }

    function setTabIndex(value: number) {
        if (tabIndex !== value) {
            tabIndex = value;
            refresh();
        }
    }

    function itemIsRoute(item: Item) {
        return !!item?.route;
    }

    async function deleteItem(item: CollectionItemOrGroup) {
        try {
            DEV_LOG && console.log('deleteItem', item.type, item.id);
            if (item.type === 'group') {
                // const groupKey = (item as CollectionGroup).name || 'none';
                // const collapsed = (item as CollectionGroup).collapse;
                // const subItems = groupedItems[groupKey];
                // const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === (item as CollectionGroup).id);
                // for (let index = 0; index < subItems.length; index++) {
                //     const item = subItems[index];
                //     await itemsModule.deleteItem(item);
                //     items.splice(index + groupIndex + 1, 1);
                // }
            } else {
                const index = items.indexOf(item);
                await itemsModule.deleteItem(item as CollectionItem);
                if (index !== -1) {
                    items.splice(index, 1);
                }
                DEV_LOG && console.log('deleteItem', item.id, (item as CollectionItem).groups?.length);
                const itemGroup = (item as CollectionItem).groups?.[0] || 'none';
                const group = groups[itemGroup];
                const groupedForItem = groupedItems[itemGroup];
                if (group && groupedForItem) {
                    const itemInGroupIndex = groupedForItem.findIndex((i) => i === item);
                    DEV_LOG && console.log('itemInGroupIndex', groupedForItem.length, item.id, groupedForItem);
                    if (itemInGroupIndex >= 0) {
                        groupedForItem.splice(itemInGroupIndex, 1);
                    }
                    const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === group.id);
                    DEV_LOG && console.log('deleteItem group', group, groupIndex, groupedForItem.length);
                    if (groupIndex >= 0) {
                        const groupItem = items.getItem(groupIndex) as CollectionGroup;
                        groupItem.count = groupedForItem.length;
                        updateGroupItemData(groupItem);
                        DEV_LOG && console.log('update group', groupItem);
                        items.setItem(groupIndex, groupItem);
                        if (__ANDROID__) {
                            const canvas: CanvasView = collectionView.nativeView.getViewForItemAtIndex(groupIndex).getViewById('canvas');
                            canvas?.invalidate();
                        }
                    }
                }
                itemsCount = items.length;
            }
        } catch (error) {
            showError(error);
        }
    }

    function showItemOnMap(item: Item) {
        DEV_LOG && console.log('showItemOnMap', item.onMap);
        if (item.onMap) {
            itemsModule.hideItem(item);
            item.onMap = 0;
        } else {
            itemsModule.showItem(item);
            item.onMap = 1;
        }
        item.onMap = item.onMap ? 0 : 1;
        const index = items.indexOf(item);
        if (index !== -1) {
            items.setItem(index, item);
        }
        // setMenuVisible(item, false);
        showSnack({ message: item.onMap ? lc('item_now_visible') : lc('item_now_hidden') });
    }

    function startEditingItem(item: Item) {
        getMapContext().startEditingItem(item);
        goBack();
    }

    onLanguageChanged(refresh);
    onThemeChanged(refresh);
    const circlePaint = new Paint();
    $: circlePaint.color = colorOnSurface;

    function drawerTranslationFunction(side, width, value, delta, progress) {
        const result = {
            mainContent: {
                translateX: side === 'right' ? -delta : delta
            },
            backDrop: {
                translateX: side === 'right' ? -delta : delta,
                opacity: progress * 0.1
            }
        } as any;

        return result;
    }

    async function showDetails(item: CollectionItem) {
        try {
            const RoutesList = (await import('~/components/items/ItemEdit.svelte')).default;
            navigate({ page: RoutesList, props: { item: item as Item } });
        } catch (error) {
            showError(error);
        }
    }

    function selectItem(item: CollectionItemOrGroup) {
        if (!item.selected) {
            items.some((d, index) => {
                if (d === item) {
                    if (item.type === 'group') {
                        const groupKey = (item as CollectionGroup).name || 'none';
                        const collapsed = (item as CollectionGroup).collapse;
                        const subItems = groupedItems[groupKey];
                        item.selected = true;
                        items.setItem(index, item);
                        // const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
                        const groupCount = subItems.length;
                        // console.log('selecting group', groupCount, index);
                        for (let j = 0; j < groupCount; j++) {
                            const subItem = subItems[j];
                            if (!subItem.selected) {
                                subItem.selected = true;
                                // console.log('updating subItem', j, subItem);
                                if (!collapsed) {
                                    items.setItem(index + 1 + j, subItem);
                                }
                                nbSelected++;
                            }
                        }
                    } else {
                        nbSelected++;
                        d.selected = true;
                        items.setItem(index, d);
                        if ((item as Item).groups?.length) {
                            // find nb selected items in group. If 0 unselect the group
                            const group = groups[(item as Item).groups[0]];
                            if (group) {
                                const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === group.id);
                                if (groupIndex >= 0) {
                                    const groupItem = items.getItem(groupIndex) as CollectionGroup;
                                    let groupSelectedCount = 0;
                                    for (let j = groupIndex + 1; j <= groupIndex + groupItem.count; j++) {
                                        const subItem = items.getItem(j);
                                        // console.log('test', j, index, subItem)
                                        if (subItem.selected) {
                                            groupSelectedCount++;
                                        }
                                    }
                                    if (groupSelectedCount === groupItem.count) {
                                        groupItem.selected = true;
                                        items.setItem(groupIndex, groupItem);
                                    }
                                    // items.setItem(groupIndex, groupItem);
                                }
                            }
                        }
                    }
                    return true;
                }
            });
        }
    }
    function unselectItem(item: CollectionItemOrGroup) {
        if (item.selected) {
            items.some((d, index) => {
                if (d === item) {
                    if (item.type === 'group') {
                        const groupKey = (item as CollectionGroup).name || 'none';
                        const collapsed = (item as CollectionGroup).collapse;
                        const subItems = groupedItems[groupKey];
                        item.selected = false;
                        items.setItem(index, item);
                        // const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
                        const groupCount = subItems.length;
                        for (let j = 0; j < groupCount; j++) {
                            const subItem = subItems[j];
                            if (subItem.selected) {
                                subItem.selected = false;
                                if (!collapsed) {
                                    items.setItem(index + 1 + j, subItem);
                                }
                                nbSelected--;
                            }
                        }
                    } else {
                        nbSelected--;
                        d.selected = false;
                        items.setItem(index, d);
                        if ((item as Item).groups?.length) {
                            // find nb selected items in group. If 0 unselect the group
                            const group = groups[(item as Item).groups[0]];
                            if (group) {
                                const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === group.id);
                                if (groupIndex >= 0) {
                                    const groupItem = items.getItem(groupIndex) as CollectionGroup;
                                    let groupSelectedCount = 0;
                                    for (let j = groupIndex + 1; j <= groupIndex + groupItem.count; j++) {
                                        const subItem = items.getItem(j);
                                        if (subItem.selected) {
                                            groupSelectedCount++;
                                        }
                                    }
                                    if (groupSelectedCount === 0) {
                                        groupItem.selected = false;
                                        items.setItem(groupIndex, groupItem);
                                    }
                                    // items.setItem(groupIndex, groupItem);
                                }
                            }
                        }
                    }
                    return true;
                }
            });
        }
    }
    function unselectAll() {
        nbSelected = 0;
        items.splice(0, items.length, ...items.map((i) => ({ ...i, selected: false })));
        // documents?.forEach((d, index) => {
        //         d.selected = false;
        //         documents.setItem(index, d);
        //     });
        // refresh();
    }
    let ignoreTap = false;
    function onItemLongPress(item: CollectionItemOrGroup, event?) {
        // console.log('onItemLongPress', event && event.ios && event.ios.state);
        if (event && event.ios && event.ios.state !== 1) {
            return;
        }
        if (event && event.ios) {
            ignoreTap = true;
        }
        // console.log('onItemLongPress', item, Object.keys(event));
        if (item.selected) {
            unselectItem(item);
        } else {
            selectItem(item);
        }
    }
    async function onItemTap(item: CollectionItemOrGroup, event) {
        try {
            if (ignoreTap) {
                ignoreTap = false;
                return;
            }
            // console.log('onItemTap', event && event.ios && event.ios.state, selectedSessions.length);
            if (nbSelected > 0) {
                onItemLongPress(item);
            } else if (item.type === 'group') {
                switchGroupCollapsed(item as CollectionGroup, event);
            } else {
                showDetails(item as CollectionItem);
            }
        } catch (error) {
            showError(error);
        }
    }
    const onAndroidBackButton = (data: AndroidActivityBackPressedEventData) =>
        onBackButton(page?.nativeView, () => {
            if (nbSelected > 0) {
                data.cancel = true;
                unselectAll();
            }
        });
    function getSelected() {
        const selected: Item[] = [];
        items.forEach((d, index) => {
            if (d.selected && d.type === 'group' && (d as CollectionGroup).collapse) {
                selected.push(...groupedItems[(d as CollectionGroup).name]);
            } else if (d.selected && d.type !== 'group') {
                selected.push(d as Item);
            }
        });
        return selected;
    }
    async function shareSelectedItems() {
        try {
            const selected = getSelected();
            await getMapContext().mapModule('items').shareItemsAsGeoJSON(selected);
        } catch (error) {
            showError(error);
        }
    }
    async function deleteSelectedItems() {
        DEV_LOG && console.log('deleteSelectedItems', nbSelected);
        if (nbSelected > 0) {
            try {
                const result = await confirm({
                    title: lc('delete'),
                    message: lc('confirm_delete_items', nbSelected),
                    okButtonText: lc('delete'),
                    cancelButtonText: lc('cancel')
                });
                showLoading();
                if (result) {
                    const selected = getSelected();
                    for (let index = 0; index < selected.length; index++) {
                        deleteItem(selected[index]);
                    }
                    unselectAll();
                }
            } catch (error) {
                showError(error);
            } finally {
                hideLoading();
            }
        }
    }

    onMount(() => {
        if (__ANDROID__) {
            Application.android.on(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
        getMapContext().mapModules['items'].on('itemChanged', refresh);
        // TODO: listen for item change
    });
    onDestroy(() => {
        getMapContext().mapModules['items'].off('itemChanged', refresh);
        if (__ANDROID__) {
            Application.android.off(Application.android.activityBackPressedEvent, onAndroidBackButton);
        }
    });

    async function setSelectedGroup() {
        try {
            // showLoading();
            const selected = getSelected();
            let defaultGroup;
            // if (selected.length === 1) {
            //     defaultGroup = selected[0].groups?.[0];
            // }
            const group = await promptForGroup(
                defaultGroup,
                Object.values(groups).filter((g) => g.name !== 'none')
            );
            if (typeof group === 'string') {
                const itemsModule = getMapContext().mapModules['items'];
                // console.log('group2', typeof group, `"${group}"`, selected.length);
                for (let index = 0; index < selected.length; index++) {
                    const item = selected[index];
                    await itemsModule.setItemGroup(item, group === 'none' ? undefined : group);
                }
            }
            refresh();
        } catch (error) {
            showError(error);
        } finally {
            // hideLoading();
        }
    }

    function onDrawGroup(item, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        const spans: any[] = [
            {
                text: item.name + ` (${item.count})` + '\n',
                fontWeight: 'bold',
                fontSize: 17
            }
        ];
        if (item.totalDistance) {
            spans.push(
                {
                    text: 'mdi-arrow-left-right' + ' ',
                    fontFamily: $fonts.mdi,
                    color: colorOnSurfaceVariant
                },
                {
                    text: `${convertValueToUnit(item.totalDistance, UNITS.DistanceKm).join(' ')}` + ' '
                }
            );
        }

        if (item.totalTime) {
            spans.push(
                {
                    text: 'mdi-timer-outline' + ' ',
                    fontFamily: $fonts.mdi,
                    color: colorOnSurfaceVariant
                },
                {
                    text: convertDurationSeconds(item.totalTime) + ' '
                }
            );
        }
        if (item.dplus > 0) {
            spans.push(
                {
                    text: 'mdi-arrow-top-right' + ' ',
                    fontFamily: $fonts.mdi,
                    color: colorOnSurfaceVariant
                },
                {
                    text: `${convertElevation(item.dplus)}` + ' '
                }
            );
        }
        if (item.dmin < 0) {
            spans.push(
                {
                    text: 'mdi-arrow-bottom-right' + ' ',
                    fontFamily: $fonts.mdi,
                    color: colorOnSurfaceVariant
                },
                {
                    text: `${convertElevation(-item.dmin)}` + ' '
                }
            );
        }
        const nString = createNativeAttributedString({ spans });
        // propsPaint.setTextAlign(Align.LEFT);
        groupPaint.color = colorOnSurface;
        const staticLayout = new StaticLayout(nString, groupPaint, canvas.getWidth(), LayoutAlignment.ALIGN_NORMAL, 1, 0, true);
        // canvas.save();
        // canvas.translate(0, h - staticLayout.getHeight());
        staticLayout.draw(canvas);
        // canvas.restore();
    }

    function onCollectionSwipe(event) {
        if (event.direction === 1 && tabIndex === 1) {
            setTabIndex(0);
        } else if (event.direction === 2 && tabIndex === 0) {
            setTabIndex(1);
        }
    }
    async function showItemMoreMenu(item: CollectionItem, event) {
        try {
            const actions = [
                {
                    icon: item.onMap ? 'mdi-eye-off' : 'mdi-eye',
                    name: !item.onMap ? lc('show') : lc('hide'),
                    id: 'show_hide_on_map'
                },
                {
                    icon: 'mdi-share-variant',
                    name: lc('share'),
                    id: 'share'
                },
                {
                    color: 'red',
                    icon: 'mdi-delete',
                    name: lc('delete'),
                    id: 'delete'
                }
            ];
            if (!!item.route) {
                actions.splice(actions.length - 2, 0, {
                    icon: 'mdi-pencil',
                    name: lc('edit'),
                    id: 'edit'
                });
            }
            await showPopoverMenu({
                options: actions,
                anchor: event.object,
                vertPos: VerticalPosition.BELOW,
                onClose: async (result) => {
                    if (result) {
                        switch (result.id) {
                            case 'delete':
                                deleteItem(item);
                                break;
                            case 'show_hide_on_map':
                                showItemOnMap(item);
                                break;
                            case 'share':
                                await getMapContext().mapModule('items').shareItemsAsGeoJSON([item]);
                                break;
                            case 'edit':
                                startEditingItem(item);
                                break;
                        }
                    }
                }
            });
        } catch (err) {
            showError(err);
        }
    }
    function onDrawRouteIcon(item, { canvas, object }: { canvas: Canvas; object: CanvasView }) {
        let itemIconFontFamily;
        let itemIcon;
        const itemProps = item.properties;
        if (itemIsRoute && itemProps.route && (itemProps.route.type === 'pedestrian' || itemProps.route.type === 'bicycle')) {
            itemIconFontFamily = $fonts.app;
            itemIcon = formatter.getRouteIcon(itemProps.route.type, itemProps.route.subtype);
        } else {
            if (itemProps?.fontFamily) {
                itemIconFontFamily = itemProps.fontFamily;
                itemIcon = itemProps.icon;
            } else {
                itemIconFontFamily = 'osm';
                itemIcon = osmicon(formatter.geItemIcon(item));
            }
        }
        if (itemIcon) {
            iconPaint.color = colorBackground;
            iconPaint.fontFamily = itemIconFontFamily;
            circlePaint.setAlpha(100);
            canvas.drawCircle(25, 57, 13, circlePaint);
            const paddingLeft = Utils.layout.toDeviceIndependentPixels(object.effectivePaddingLeft);
            canvas.drawText(itemIcon, paddingLeft + 17, 63, iconPaint);
        }
    }
    $: actionBarLabelColor = theme === 'eink' ? colorOnSurface : colorOnPrimary;
</script>

<page bind:this={page} actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <gridlayout rows="auto,*">
        <collectionview
            bind:this={collectionView}
            itemTemplateSelector={(item) => item.type || (!!item.route ? 'route' : 'default')}
            {items}
            row={1}
            android:paddingBottom={windowInsetBottom}
            on:swipe={onCollectionSwipe}>
            <Template key="group" let:item>
                <gridlayout backgroundColor={colorOutlineVariant} height={50} rippleColor={colorPrimary} on:tap={(e) => onItemTap(item, e)} on:longPress={(e) => onItemLongPress(item, e)}>
                    <canvasview id="canvas" margin="5 30 5 10" on:draw={(e) => onDrawGroup(item, e)} />
                    <IconButton
                        horizontalAlignment="right"
                        marginRight={60}
                        size={40}
                        text={item.onMap === 0 ? 'mdi-eye-off-outline' : 'mdi-eye'}
                        tooltip={item.onMap === 0 ? lc('show') : lc('hide')}
                        verticalAlignment="middle"
                        on:tap={(e) => switchGroupOnMap(item, e)} />
                    <IconButton
                        id="collapseButton"
                        horizontalAlignment="right"
                        marginRight={10}
                        rotate={item.collapse ? 180 : 0}
                        size={40}
                        text="mdi-chevron-up"
                        tooltip={lc('collapse')}
                        verticalAlignment="middle"
                        on:tap={(e) => switchGroupCollapsed(item, e)} />
                    <SelectedIndicator selected={item.selected} />
                </gridlayout>
            </Template>
            <Template key="route" let:item>
                <BottomSheetInfoView
                    backgroundColor={colorBackground}
                    borderBottomColor={colorOutlineVariant}
                    borderBottomWidth={1}
                    height={80}
                    {item}
                    marginBottom={34}
                    marginLeft={60}
                    opacity={item.onMap || 0.6}
                    padding="4 0 2 10"
                    propsBottom={34}
                    propsLeft={60}
                    rightTextPadding={40}
                    rippleColor={colorPrimary}
                    selectable={false}
                    showIcon={false}
                    subtitleEnabled={false}
                    titleVerticalTextAlignment="middle"
                    on:tap={(e) => onItemTap(item, e)}
                    on:longPress={(e) => onItemLongPress(item, e)}>
                    <image borderRadius={8} disableCss={true} height={50} horizontalAlignment="left" marginTop={6} src={item.image_path} stretch="aspectFill" verticalAlignment="top" width={50} />
                    <canvasView on:draw={(event) => onDrawRouteIcon(item, event)} />
                    <SelectedIndicator selected={item.selected} />
                    <IconButton slot="above" gray={true} horizontalAlignment="right" text="mdi-dots-vertical" verticalAlignment="top" on:tap={(e) => showItemMoreMenu(item, e)} />
                </BottomSheetInfoView>
            </Template>
            <Template let:item>
                <BottomSheetInfoView
                    backgroundColor={colorBackground}
                    borderBottomColor={colorOutlineVariant}
                    borderBottomWidth={1}
                    height={80}
                    {item}
                    opacity={item.onMap || 0.6}
                    rippleColor={colorPrimary}
                    selectable={false}
                    on:tap={(e) => onItemTap(item, e)}
                    on:longPress={(e) => onItemLongPress(item, e)}>
                    <SelectedIndicator selected={item.selected} />
                    <IconButton slot="above" gray={true} horizontalAlignment="right" text="mdi-dots-vertical" verticalAlignment="top" on:tap={(e) => showItemMoreMenu(item, e)} />
                </BottomSheetInfoView>
            </Template>
        </collectionview>
        <canvaslabel
            color={colorOnSurfaceVariant}
            row={1}
            text={tabIndex === 1 ? lc('no_marker') : lc('no_route')}
            textAlignment="center"
            verticalTextAlignment="middle"
            visibility={loading || itemsCount ? 'hidden' : 'visible'} />
        <mdactivityindicator busy={true} horizontalAlignment="center" row={1} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />

        <CActionBar forceCanGoBack={nbSelected > 0} onGoBack={nbSelected ? unselectAll : null} title={nbSelected ? lc('selected', nbSelected) : lc('items')}>
            <IconButton color={colorError} isVisible={nbSelected > 0} text="mdi-delete" on:tap={deleteSelectedItems} />
            <IconButton color={actionBarLabelColor} isVisible={nbSelected > 0} text="mdi-share-variant" on:tap={shareSelectedItems} />
            <IconButton color={actionBarLabelColor} isVisible={nbSelected > 0} text="mdi-tag-plus-outline" on:tap={setSelectedGroup} />
            <gridlayout slot="bottom" colSpan={3} columns="*,*" height={48} row={1}>
                <canvaslabel
                    color={actionBarLabelColor}
                    disableCss={true}
                    fontSize={15}
                    fontWeight="500"
                    rippleColor={actionBarLabelColor}
                    text={lu('routes')}
                    textAlignment="center"
                    verticalTextAlignment="center"
                    on:tap={() => setTabIndex(0)} />
                <canvaslabel
                    col={1}
                    color={actionBarLabelColor}
                    disableCss={true}
                    fontSize={15}
                    fontWeight="500"
                    rippleColor={actionBarLabelColor}
                    text={lu('markers')}
                    textAlignment="center"
                    verticalTextAlignment="center"
                    on:tap={() => setTabIndex(1)} />
                <absolutelayout backgroundColor={actionBarLabelColor} colSpan={2} height={3} horizontalAlignment={tabIndex === 1 ? 'right' : 'left'} verticalAlignment="bottom" width="50%" />
            </gridlayout>
        </CActionBar>
    </gridlayout>
</page>
