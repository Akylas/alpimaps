<script lang="ts">
    import { Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { AndroidActivityBackPressedEventData, Application, EventData, LayoutBase, ObservableArray, View } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, goBack, navigate } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { lc, lu, onLanguageChanged } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Group, Item } from '~/models/Item';
    import { onServiceLoaded, onServiceStarted } from '~/services/BgService.common';
    import { showError } from '~/utils/error';
    import { actionBarButtonHeight, actionBarHeight, backgroundColor, borderColor, navigationBarHeight, primaryColor, subtitleColor, textColor } from '~/variables';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';
    import { CollectionViewWithSwipeMenu } from '@nativescript-community/ui-collectionview-swipemenu';
    import { onDestroy, onMount } from 'svelte';
    import SelectedIndicator from './SelectedIndicator.svelte';
    import { promptForGroup } from '~/utils/ui';

    let collectionView: NativeViewElementNode<CollectionView>;
    type MapGroup = Group & { collapsed: boolean };
    type CollectionGroup = MapGroup & { type: 'group'; count: number; selected?: boolean };
    type CollectionItem = (Item & { groupOnMap?: 0 | 1; selected?: boolean }) | CollectionGroup;
    let items: ObservableArray<CollectionItem>;
    let groupedItems: { [k: string]: Item[] };
    let groups: { [k: string]: MapGroup };
    let itemsCount = 0;
    let tabIndex = 0;
    let nbSelected = 0;
    const itemsModule = getMapContext().mapModule('items');
    onServiceStarted(refresh);

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

    async function refresh() {
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
                groups = groupBy<Group>(await itemsModule.groupsRepository.search(), (i) => i.name);
                groupedItems = groupByArray<Item>(sqlItems, (i) => i.groups);
                const noneGroupItems: Array<CollectionItem> = groupedItems['none'] || [];
                delete groupedItems['none'];
                items = new ObservableArray(
                    Object.keys(groupedItems).reduce((acc, key) => {
                        const group = groups[key];
                        const subItems = groupedItems[key].map((i) => ({ ...i, groupOnMap: group.onMap }));
                        acc.push({ type: 'group', ...group, count: subItems.length }, ...(group.collapsed ? [] : subItems));
                        return acc;
                    }, noneGroupItems)
                );
                itemsCount = items.length;
            } catch (error) {
                showError(error);
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
                const group = groups[item.groups[0]];
                if (group) {
                    const groupIndex = items.findIndex((i) => i.type === 'group' && i.id === group.id);
                    if (groupIndex >= 0) {
                        const groupItem = items.getItem(groupIndex);
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
            // console.log('group', typeof group, `"${group}"`);
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
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <CActionBar title={nbSelected ? lc('selected', nbSelected) : lc('items')} onGoBack={nbSelected ? unselectAll : null} forceCanGoBack={nbSelected > 0}>
            <IconButton text="mdi-share-variant" color="white" on:tap={shareSelectedItems} isVisible={nbSelected > 0} />
            <IconButton text="mdi-tag-plus-outline" color="white" on:tap={setSelectedGroup} isVisible={nbSelected > 0} />
            <gridlayout slot="bottom" columns="*,*" height={48}>
                <label text={lu('routes')} textAlignment="center" verticalTextAlignment="center" fontWeight="500" color="white" on:tap={() => setTabIndex(0)} rippleColor="white" />
                <label text={lu('markers')} col={1} textAlignment="center" verticalTextAlignment="center" fontWeight="500" color="white" on:tap={() => setTabIndex(1)} rippleColor="white" />
                <absolutelayout colSpan={2} width="50%" height={3} backgroundColor="white" verticalAlignment="bottom" horizontalAlignment={tabIndex === 1 ? 'right' : 'left'} />
            </gridlayout>
        </CActionBar>
        <collectionview bind:this={collectionView} row={1} {items} itemTemplateSelector={(item) => item.type || (!!item.route ? 'route' : 'default')} android:paddingBottom={$navigationBarHeight}>
            <Template let:item key="group">
                <gridlayout height={40} on:tap={(e) => onItemTap(item, e)} on:longPress={(e) => onItemLongPress(item, e)} backgroundColor={$borderColor} rippleColor={primaryColor}>
                    <label padding={10} text={item.name + ` (${item.count})`} horizontalAlignment="left" verticalAlignment="middle" />
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
                <swipemenu
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
                >
                    <gridlayout prop:mainContent backgroundColor={$backgroundColor} on:tap={(e) => onItemTap(item, e)} on:longPress={(e) => onItemLongPress(item, e)} rippleColor={primaryColor}>
                        <BottomSheetInfoView
                            {item}
                            marginLeft={60}
                            propsLeft={60}
                            iconLeft={17}
                            iconTop={63}
                            iconColor={$backgroundColor}
                            {onDraw}
                            iconSize={16}
                            opacity={(item.onMap && item.groupOnMap) || 0.6}
                        >
                            <image noCache={true} src={item.image_path} borderRadius={8} width={50} height={50} horizontalAlignment="left" verticalAlignment="top" marginTop={10} />
                        </BottomSheetInfoView>
                        <SelectedIndicator selected={item.selected} />
                    </gridlayout>
                    <stacklayout prop:leftDrawer orientation="horizontal" height="100%">
                        <IconButton on:tap={() => deleteItem(item)} tooltip={lc('delete')} shape="none" width={60} height="100%" color="white" backgroundColor="red" text="mdi-trash-can" />
                    </stacklayout>
                    <stacklayout prop:rightDrawer orientation="horizontal">
                        <IconButton on:tap={() => startEditingItem(item)} tooltip={lc('edit')} text={'mdi-pencil'} shape="none" width={60} height="100%" color="white" backgroundColor={primaryColor} />
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
                </swipemenu>
            </Template>
            <Template let:item>
                <swipemenu
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
                >
                    <gridlayout prop:mainContent backgroundColor={$backgroundColor} on:tap={(e) => onItemTap(item, e)} on:longPress={(e) => onItemLongPress(item, e)} rippleColor={primaryColor}>
                        <BottomSheetInfoView {item} opacity={(item.onMap && item.groupOnMap) || 0.6} />
                        <SelectedIndicator selected={item.selected} />
                    </gridlayout>
                    <stacklayout prop:leftDrawer orientation="horizontal" height="100%">
                        <IconButton on:tap={() => deleteItem(item)} tooltip={lc('delete')} shape="none" width={60} height="100%" color="white" backgroundColor="red" text="mdi-trash-can" />
                    </stacklayout>
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
                </swipemenu>
            </Template>
        </collectionview>
        <label
            row={1}
            text={tabIndex === 1 ? lc('no_marker') : lc('no_route')}
            color={$subtitleColor}
            visibility={itemsCount ? 'hidden' : 'visible'}
            textAlignment="center"
            verticalAlignment="middle"
        />
    </gridlayout>
</page>
