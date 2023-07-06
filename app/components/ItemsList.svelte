<script lang="ts">
    import { Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { ObservableArray } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, goBack, navigate } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { lc, lu, onLanguageChanged } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { showError } from '~/utils/error';
    import { actionBarButtonHeight, actionBarHeight, backgroundColor, borderColor, navigationBarHeight, primaryColor, subtitleColor, textColor } from '~/variables';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';

    let collectionView: NativeViewElementNode<CollectionView>;
    let items: ObservableArray<Item>;
    let itemsCount = 0;
    let tabIndex = 0;
    const itemsModule = getMapContext().mapModule('items');
    onServiceLoaded(refresh);

    async function refresh() {
        const sqlItems = await itemsModule.itemRepository.searchItem(tabIndex === 1 ? SqlQuery.createFromTemplateString`"route" IS NULL` : SqlQuery.createFromTemplateString`"route" IS NOT NULL`);
        items = new ObservableArray(sqlItems);
        itemsCount = items.length;
    }

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
            canvas.drawCircle(25, 58, 13, circlePaint);
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

    async function showDetails(item) {
        try {
            const RoutesList = (await import('~/components/ItemEdit.svelte')).default as any;
            navigate({ page: RoutesList, props: { item } });
        } catch (error) {
            showError(error);
        }
    }
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <CActionBar canGoBack title={lc('items')}>
            <gridlayout slot="bottom" columns="*,*" height={48}>
                <label text={lu('routes')} textAlignment="center" verticalTextAlignment="center" fontWeight="500" color="white" on:tap={() => setTabIndex(0)} rippleColor="white" />
                <label text={lu('markers')} col={1} textAlignment="center" verticalTextAlignment="center" fontWeight="500" color="white" on:tap={() => setTabIndex(1)} rippleColor="white" />
                <absolutelayout colSpan={2} width="50%" height={3} backgroundColor="white" verticalAlignment="bottom" horizontalAlignment={tabIndex === 1 ? 'right' : 'left'} />
            </gridlayout>
        </CActionBar>
        <collectionview bind:this={collectionView} row={1} {items} rowHeight={80} itemTemplateSelector={(item) => (!!item.route ? 'route' : 'default')} android:paddingBottom={$navigationBarHeight}>
            <Template let:item key="route">
                <swipemenu
                    id={item.name}
                    leftSwipeDistance={0}
                    rightSwipeDistance={0}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                >
                    <gridlayout prop:mainContent backgroundColor={$backgroundColor} on:tap={() => showDetails(item)}>
                        <BottomSheetInfoView {item} marginLeft={60} propsLeft={60} iconLeft={17} iconTop={64} iconColor={$backgroundColor} {onDraw} iconSize={16}>
                            <image noCache={true} src={item.image_path} borderRadius={8} width={50} height={50} horizontalAlignment="left" verticalAlignment="top" marginTop={10} />
                        </BottomSheetInfoView>
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
                    leftSwipeDistance={0}
                    rightSwipeDistance={0}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                >
                    <gridlayout prop:mainContent backgroundColor={$backgroundColor} on:tap={() => showDetails(item)}>
                        <BottomSheetInfoView {item} />
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
