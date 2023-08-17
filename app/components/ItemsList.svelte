<script lang="ts" context="module">
    import { Canvas, CanvasView, LayoutAlignment, Paint, StaticLayout } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { AndroidActivityBackPressedEventData, Application, LayoutBase, NavigatedData, ObservableArray, View } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { onDestroy, onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, goBack, navigate } from 'svelte-native/dom';
    import { convertDurationSeconds, lc, lu, onLanguageChanged } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Group, Item } from '~/models/Item';
    import { isServiceStarted, onServiceStarted } from '~/services/BgService.common';
    import { showError } from '~/utils/error';
    import { hideLoading, promptForGroup, showLoading } from '~/utils/ui';
    import { backgroundColor, borderColor, lightBackgroundColor, mdiFontFamily, navigationBarHeight, primaryColor, subtitleColor, textColor } from '~/variables';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';
    import SelectedIndicator from './SelectedIndicator.svelte';
    import { confirm } from '@nativescript-community/ui-material-dialogs';
    import { UNITS, convertElevation, convertValueToUnit } from '~/helpers/formatter';
    import { createNativeAttributedString } from '@nativescript-community/text';
    import { HorizontalPosition, VerticalPosition } from '@nativescript-community/ui-popover';
    import { closePopover, showPopover } from '@nativescript-community/ui-popover/svelte';
    type MapGroup = Group & { collapsed: boolean };
    type CollectionGroup = MapGroup & { type: 'group'; count: number; selected?: boolean; totalTime?: number; totalDistance?: number };
    type CollectionItem = (Item & { groupOnMap?: 0 | 1; selected?: boolean }) | CollectionGroup;

    const groupPaint = new Paint();
    groupPaint.textSize = 12;
</script>

<script lang="ts">
    let collectionView: NativeViewElementNode<CollectionView>;
    let items: ObservableArray<CollectionItem>;
    let groupedItems: { [k: string]: Item[] };
    let groups: { [k: string]: MapGroup };
    let itemsCount = 0;
    let tabIndex = 0;
    let nbSelected = 0;
    const itemsModule = getMapContext().mapModule('items');
    let needsFirstRefresh = true;
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
        const subItems = groupedItems[groupItem.name];

        subItems.forEach((item) => {
            if (group) {
                item['groupOnMap'] = group.onMap;
            }
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
        needsFirstRefresh = false;
        loading = true;
        // if itemslist is opened too fast the db might not be fully initialized
        itemsModule.onDbInit(async () => {
            try {
                nbSelected = 0;
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
                const sqlItems = (await itemsModule.itemRepository.searchItem(searchArgs)).map((i) => ({ ...i, groupOnMap: 1 }));
                const oldGroups = groups;
                groups = groupBy<Group>(await itemsModule.groupsRepository.search(), (i) => i.name);
                if (oldGroups) {
                    Object.keys(oldGroups).forEach((k) => {
                        if (groups[k]) {
                            groups[k].collapsed = oldGroups[k].collapsed;
                        }
                    });
                }
                groupedItems = groupByArray<Item>(sqlItems, (i) => i.groups);
                const noneGroupItems: Array<CollectionItem> = groupedItems['none'] || [];
                delete groupedItems['none'];
                items = new ObservableArray(
                    Object.keys(groupedItems).reduce((acc, key) => {
                        const group = groups[key];
                        const subItems = groupedItems[key];
                        const groupItem = { type: 'group', ...group, count: subItems.length } as CollectionGroup;
                        updateGroupItemData(groupItem, group);
                        acc.push(groupItem, ...(group.collapsed ? [] : subItems));
                        return acc;
                    }, noneGroupItems)
                );
                itemsCount = items.length;
            } catch (error) {
                showError(error);
            } finally {
                loading = false;
            }
        });
    }
    function switchGroupVisibility(item: Group) {
        const visible = (1 - groups[item.id].onMap) as 0 | 1;
        if (visible == groups[item.id].onMap) {
            return;
        }
        groups[item.id].onMap = visible;
        const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
        if (visible) {
            if (groupIndex >= 0) {
                items.splice(groupIndex + 1, 0, ...groupedItems[item.id]);
            }
        } else {
            if (groupIndex >= 0) {
                items.splice(groupIndex + 1, groupedItems[item.id].length);
            }
        }
    }
    function switchGroupCollapsed(item: Group, event) {
        const collapsed = !groups[item.name].collapsed;
        if (collapsed == groups[item.name].collapsed) {
            return;
        }
        groups[item.name].collapsed = collapsed;
        let collapseButton = event.object as View;
        if (collapseButton instanceof LayoutBase) {
            collapseButton = collapseButton.getViewById('collapseButton');
        }
        collapseButton.animate({
            duration: 200,
            rotate: collapsed ? 180 : 0
        });
        const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
        if (groupIndex >= 0) {
            const groupItem = items.getItem(groupIndex);
            (groupItem as CollectionGroup).collapsed = collapsed;
            items.setItem(groupIndex, groupItem);
            if (collapsed) {
                items.splice(groupIndex + 1, groupedItems[item.name].length);
            } else {
                items.splice(groupIndex + 1, 0, ...groupedItems[item.name]);
            }
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

    function deleteItem(item: Item) {
        try {
            const index = items.indexOf(item);
            itemsModule.deleteItem(item);
            if (index !== -1) {
                items.splice(index, 1);
            }
            if (item.groups?.length) {
                const itemGroup = item.groups[0];
                const group = groups[itemGroup];
                if (group) {
                    const groupedForItem = groupedItems[itemGroup];
                    let groupIndex = groupedForItem.findIndex((i) => i === item);
                    if (groupIndex >= 0) {
                        groupedForItem.splice(groupIndex, 1);
                    }
                    groupIndex = items.findIndex((i) => i.type === 'group' && i.id === group.id);
                    if (groupIndex >= 0) {
                        const groupItem = items.getItem(groupIndex) as CollectionGroup;
                        updateGroupItemData(groupItem);
                        items.setItem(groupIndex, groupItem);
                    }
                }
            }
            itemsCount = items.length;
        } catch (error) {
            showError(error);
        }
    }

    function showItemOnMap(item: Item) {
        if (item.onMap) {
            itemsModule.hideItem(item);
        } else {
            itemsModule.showItem(item);
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
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            circlePaint.color = $textColor;
            canvas.drawCircle(25, 57, 13, circlePaint);
        } catch (error) {
            console.error(error, error.stack);
        }
    }
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
            const RoutesList = (await import('~/components/ItemEdit.svelte')).default as any;
            navigate({ page: RoutesList, props: { item } });
        } catch (error) {
            showError(error);
        }
    }

    function selectItem(item: CollectionItem) {
        if (!item.selected) {
            items.some((d, index) => {
                if (d === item) {
                    if (item.type === 'group') {
                        // const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
                        const groupCount = groupedItems[(item as Group).name].length;
                        // console.log('selecting group', groupCount, index);
                        for (let j = index; j < index + groupCount + 1; j++) {
                            const subItem = items.getItem(j);
                            if (!subItem.selected) {
                                subItem.selected = true;
                                // console.log('updating subItem', j, subItem);
                                items.setItem(j, subItem);
                                if (j > index) {
                                    nbSelected++;
                                }
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
    function unselectItem(item: CollectionItem) {
        if (item.selected) {
            items.some((d, index) => {
                if (d === item) {
                    if (item.type === 'group') {
                        // const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === item.id);
                        const groupCount = groupedItems[(item as Group).name].length;
                        for (let j = index; j < index + groupCount + 1; j++) {
                            const subItem = items.getItem(j);
                            if (subItem.selected) {
                                subItem.selected = false;
                                items.setItem(j, subItem);
                                if (j > index) {
                                    nbSelected--;
                                }
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
    function onItemLongPress(item: CollectionItem, event?) {
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
    async function onItemTap(item: CollectionItem, event) {
        try {
            if (ignoreTap) {
                ignoreTap = false;
                return;
            }
            // console.log('onItemTap', event && event.ios && event.ios.state, selectedSessions.length);
            if (nbSelected > 0) {
                onItemLongPress(item);
            } else if (item.type === 'group') {
                switchGroupCollapsed(item as Group, event);
            } else {
                showDetails(item);
            }
        } catch (error) {
            showError(error);
        }
    }
    function onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        if (__ANDROID__) {
            if (nbSelected > 0) {
                data.cancel = true;
                unselectAll();
            }
        }
    }

    function getSelected() {
        const selected: Item[] = [];
        items.forEach((d, index) => {
            if (d.selected && d.type !== 'group') {
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
        if (nbSelected > 0) {
            try {
                const result = await confirm({
                    title: lc('delete'),
                    message: lc('confirm_delete_documents', nbSelected),
                    okButtonText: lc('delete'),
                    cancelButtonText: lc('cancel')
                });
                showLoading();
                if (result) {
                    const selected = getSelected();
                    for (let index = 0; index < selected.length; index++) {
                        await deleteItem(selected[index]);
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
            if (selected.length === 1) {
                defaultGroup = selected[0].groups?.[0];
            }
            const group = await promptForGroup(defaultGroup, Object.values(groups));
            if (typeof group === 'string') {
                const itemsModule = getMapContext().mapModules['items'];
                // console.log('group2', typeof group, `"${group}"`, selected.length);
                for (let index = 0; index < selected.length; index++) {
                    const item = selected[index];
                    await itemsModule.setItemGroup(item, group);
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
        let w = canvas.getWidth();
        let h = canvas.getHeight();
        let spans: any[] = [
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
                    fontFamily: mdiFontFamily,
                    color: $subtitleColor
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
                    fontFamily: mdiFontFamily,
                    color: $subtitleColor
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
                    fontFamily: mdiFontFamily,
                    color: $subtitleColor
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
                    fontFamily: mdiFontFamily,
                    color: $subtitleColor
                },
                {
                    text: `${convertElevation(-item.dmin)}` + ' '
                }
            );
        }
        const nString = createNativeAttributedString({ spans });
        // propsPaint.setTextAlign(Align.LEFT);
        groupPaint.color = $textColor;
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
    async function showItemMoreMenu(item: Item, event) {
        try {
            const actions: any[] = [
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
            const OptionSelect = (await import('~/components/OptionSelect.svelte')).default;
            const result = await showPopover<any>({
                vertPos: VerticalPosition.ALIGN_TOP,
                horizPos: HorizontalPosition.ALIGN_LEFT,
                view: OptionSelect as any,
                fitInScreen: true,
                anchor: event.object,
                props: {
                    showBorders: false,
                    backgroundColor: $lightBackgroundColor,
                    options: actions,
                    borderRadius: 6,
                    rowHeight: 50,
                    onClose: closePopover,
                    fontWeight: 'normal',
                    width: 200
                }
            });
            if (result) {
                switch (result.id) {
                    case 'delete':
                        await deleteItem(item as Item);
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
        } catch (err) {
            showError(err);
        }
    }
</script>

<page actionBarHidden={true} on:navigatedTo={onNavigatedTo}>
    <gridlayout rows="auto,*">
        <CActionBar title={nbSelected ? lc('selected', nbSelected) : lc('items')} onGoBack={nbSelected ? unselectAll : null} forceCanGoBack={nbSelected > 0}>
            <IconButton text="mdi-delete" color="red" on:tap={deleteSelectedItems} isVisible={nbSelected > 0} />
            <IconButton text="mdi-share-variant" color="white" on:tap={shareSelectedItems} isVisible={nbSelected > 0} />
            <IconButton text="mdi-tag-plus-outline" color="white" on:tap={setSelectedGroup} isVisible={nbSelected > 0} />
            <gridlayout slot="bottom" columns="*,*" height={48}>
                <canvaslabel
                    fontSize={15}
                    fontWeight="500"
                    disableCss={true}
                    text={lu('routes')}
                    textAlignment="center"
                    verticalTextAlignment="center"
                    color="white"
                    on:tap={() => setTabIndex(0)}
                    rippleColor="white"
                />
                <canvaslabel
                    disableCss={true}
                    text={lu('markers')}
                    col={1}
                    textAlignment="center"
                    verticalTextAlignment="center"
                    fontSize={15}
                    fontWeight="500"
                    color="white"
                    on:tap={() => setTabIndex(1)}
                    rippleColor="white"
                />
                <absolutelayout colSpan={2} width="50%" height={3} backgroundColor="white" verticalAlignment="bottom" horizontalAlignment={tabIndex === 1 ? 'right' : 'left'} />
            </gridlayout>
        </CActionBar>
        <!-- svelte-ignore illegal-attribute-character -->
        <collectionview
            bind:this={collectionView}
            row={1}
            {items}
            itemTemplateSelector={(item) => item.type || (!!item.route ? 'route' : 'default')}
            android:paddingBottom={$navigationBarHeight}
            on:swipe={onCollectionSwipe}
        >
            <Template let:item key="group">
                <gridlayout height={50} on:tap={(e) => onItemTap(item, e)} on:longPress={(e) => onItemLongPress(item, e)} backgroundColor={$borderColor} rippleColor={primaryColor}>
                    <canvas margin="5 30 5 10" on:draw={(e) => onDrawGroup(item, e)} />
                    <IconButton
                        on:tap={(e) => switchGroupCollapsed(item, e)}
                        marginRight={10}
                        size={40}
                        tooltip={lc('collapse')}
                        text="mdi-chevron-up"
                        horizontalAlignment="right"
                        verticalAlignment="middle"
                        rotate={item.collapsed ? 180 : 0}
                        id="collapseButton"
                    />
                    <SelectedIndicator selected={item.selected} />
                </gridlayout>
            </Template>
            <Template let:item key="route">
                <!-- <swipemenu
                    id={item.name}
                    height={100}
                    disableCss={true}
                    leftSwipeDistance={nbSelected > 0 ? -1 : 0}
                    rightSwipeDistance={nbSelected > 0 ? -1 : 0}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    backDropEnabled={false}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                    borderBottomWidth={1}
                    borderBottomColor={$borderColor}
                > -->
                <!-- svelte-ignore illegal-attribute-character -->
                <BottomSheetInfoView
                    {item}
                    height={80}
                    marginLeft={60}
                    marginBottom={34}
                    padding="4 0 2 10"
                    propsLeft={60}
                    rightTextPadding={40}
                    propsBottom={34}
                    iconLeft={17}
                    iconTop={63}
                    titleVerticalTextAlignment="middle"
                    subtitleEnabled={false}
                    iconColor={$backgroundColor}
                    {onDraw}
                    iconSize={16}
                    opacity={(item.onMap && item.groupOnMap) || 0.6}
                    prop:mainContent
                    backgroundColor={$backgroundColor}
                    on:tap={(e) => onItemTap(item, e)}
                    on:longPress={(e) => onItemLongPress(item, e)}
                    rippleColor={primaryColor}
                    borderBottomWidth={1}
                    borderBottomColor={$borderColor}
                >
                    <image disableCss={true} src={item.image_path} width={50} height={50} borderRadius={8} horizontalAlignment="left" verticalAlignment="top" marginTop={6} />
                    <SelectedIndicator selected={item.selected} />
                    <IconButton text="mdi-dots-vertical" gray={true} slot="above" horizontalAlignment="right" verticalAlignment="top" on:tap={(e) => showItemMoreMenu(item, e)} />
                </BottomSheetInfoView>
                <!-- svelte-ignore illegal-attribute-character -->
                <!-- <IconButton prop:leftDrawer on:tap={() => deleteItem(item)} shape="none" width={60} height="100%" color="white" backgroundColor="red" text="mdi-trash-can" /> -->
                <!-- svelte-ignore illegal-attribute-character -->
                <!-- <stacklayout prop:rightDrawer orientation="horizontal">
                        <IconButton on:tap={() => startEditingItem(item)} text={'mdi-pencil'} shape="none" width={60} height="100%" color="white" backgroundColor={primaryColor} />
                        <IconButton
                            on:tap={() => showItemOnMap(item)}
                            text={!item.onMap ? 'mdi-eye-off' : 'mdi-eye'}
                            shape="none"
                            width={60}
                            height="100%"
                            color="white"
                            backgroundColor={!item.onMap ? 'gray' : 'blue'}
                        />
                    </stacklayout> -->
                <!-- </swipemenu> -->
            </Template>
            <Template let:item>
                <!-- <swipemenu
                    id={item.name}
                    height={80}
                    leftSwipeDistance={nbSelected > 0 ? -1 : 0}
                    rightSwipeDistance={nbSelected > 0 ? -1 : 0}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                    borderBottomWidth={1}
                    borderBottomColor={$borderColor}
                > -->
                <!-- svelte-ignore illegal-attribute-character -->
                <BottomSheetInfoView
                    {item}
                    height={80}
                    opacity={(item.onMap && item.groupOnMap) || 0.6}
                    prop:mainContent
                    backgroundColor={$backgroundColor}
                    on:tap={(e) => onItemTap(item, e)}
                    on:longPress={(e) => onItemLongPress(item, e)}
                    rippleColor={primaryColor}
                    borderBottomWidth={1}
                    borderBottomColor={$borderColor}
                >
                    <SelectedIndicator selected={item.selected} />
                    <IconButton text="mdi-dots-vertical" gray={true} slot="above" horizontalAlignment="right" verticalAlignment="top" on:tap={(e) => showItemMoreMenu(item, e)} />
                </BottomSheetInfoView>

                <!-- svelte-ignore illegal-attribute-character -->
                <!-- <stacklayout prop:leftDrawer orientation="horizontal" height="100%">
                        <IconButton on:tap={() => deleteItem(item)} tooltip={lc('delete')} shape="none" width={60} height="100%" color="white" backgroundColor="red" text="mdi-trash-can" />
                    </stacklayout>
                    <!-- svelte-ignore illegal-attribute-character -->
                <stacklayout prop:rightDrawer orientation="horizontal">
                    <IconButton
                        on:tap={() => showItemOnMap(item)}
                        tooltip={lc('show')}
                        text={!item.onMap ? 'mdi-eye-off' : 'mdi-eye'}
                        shape="none"
                        width={60}
                        height="100%"
                        color="white"
                        backgroundColor={!item.onMap ? 'gray' : 'blue'}
                    />
                </stacklayout>
                -->
                <!-- </swipemenu> -->
            </Template>
        </collectionview>
        <canvaslabel
            row={1}
            text={tabIndex === 1 ? lc('no_marker') : lc('no_route')}
            color={$subtitleColor}
            visibility={loading || itemsCount ? 'hidden' : 'visible'}
            textAlignment="center"
            verticalTextAlignment="middle"
        />
        <mdactivityindicator row={1} visibility={loading ? 'visible' : 'hidden'} busy={true} horizontalAlignment="center" verticalAlignment="middle" />
    </gridlayout>
</page>
