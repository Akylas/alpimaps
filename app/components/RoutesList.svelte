<script lang="ts">
    import { Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { ObservableArray } from '@nativescript/core';
    import SqlQuery from 'kiss-orm/dist/Queries/SqlQuery';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { GeoHandler } from '~/handlers/GeoHandler';
    import { lc, onLanguageChanged } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { getMapContext } from '~/mapModules/MapModule';
    import { Item } from '~/models/Item';
    import { onServiceLoaded } from '~/services/BgService.common';
    import { showError } from '~/utils/error';
    import { backgroundColor, borderColor, subtitleColor, textColor } from '~/variables';
    import BottomSheetInfoView from './BottomSheetInfoView.svelte';
    import CActionBar from './CActionBar.svelte';
    import IconButton from './IconButton.svelte';

    let collectionView: NativeViewElementNode<CollectionView>;
    type RouteItem = Item;
    let items: ObservableArray<RouteItem>;
    const itemsModule = getMapContext().mapModule('items');
    onServiceLoaded(refresh);

    async function refresh() {
        const sqlItems = await itemsModule.itemRepository.searchItem(SqlQuery.createFromTemplateString`"route" IS NOT NULL`);
        items = new ObservableArray(sqlItems);
    }

    function itemIsRoute(item: RouteItem) {
        return !!item?.route;
    }

    function deleteItem(item: RouteItem) {
        try {
            const index = items.indexOf(item);
            itemsModule.deleteItem(item);
            if (index !== -1) {
                items.splice(index, 1);
            }
        } catch (error) {
            showError(error);
        }
    }

    function showItemOnMap(item: RouteItem) {
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
        showSnack({ message: item.onMap ? lc('route_now_visible') : lc('route_now_hidden') });
    }

    onLanguageChanged(refresh);
    onThemeChanged(refresh);
    const circlePaint = new Paint();
    function onDraw({ canvas, object }: { canvas: Canvas; object: CanvasView }) {
        try {
            circlePaint.color = $textColor;
            canvas.drawCircle(25, 58, 13, circlePaint);
        } catch (error) {
            console.error(error);
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
</script>

<page actionBarHidden={true}>
    <gridlayout rows="auto,*">
        <CActionBar canGoBack title={lc('routes')} />
        <collectionview bind:this={collectionView} row={1} {items} rowHeight={80}>
            <Template let:item>
                <swipemenu
                    id={item.name}
                    leftSwipeDistance={200}
                    rightSwipeDistance={200}
                    startingSide={item.startingSide}
                    translationFunction={drawerTranslationFunction}
                    openAnimationDuration={100}
                    closeAnimationDuration={100}
                >
                    <gridlayout prop:mainContent backgroundColor={$backgroundColor}>
                        <BottomSheetInfoView {item} marginLeft={60} propsLeft={60} iconLeft={17} iconTop={64} iconColor={$backgroundColor} {onDraw} iconSize={16}>
                            <image src={item.image_path} borderRadius={8} width={50} height={50} horizontalAlignment="left" verticalAlignment="top" marginTop={10} />
                        </BottomSheetInfoView>
                    </gridlayout>
                    <stacklayout prop:leftDrawer orientation="horizontal" height="100%">
                        <IconButton on:tap={() => deleteItem(item)} tooltip={lc('delete')} shape="none" width={60} height="100%" color="white" backgroundColor="red" text="mdi-trash-can" />
                    </stacklayout>
                    <stacklayout prop:rightDrawer orientation="horizontal">
                        <IconButton
                            on:tap={() => showItemOnMap(item)}
                            tooltip={lc('show')}
                            isVisible={itemIsRoute(item)}
                            text={item.onMap ? 'mdi-eye-off' : 'mdi-eye'}
                            shape="none"
                            width={60}
                            height="100%"
                            color="white"
                            backgroundColor={item.onMap ? 'gray' : 'blue'}
                        />
                    </stacklayout>
                </swipemenu>
            </Template>
        </collectionview>
        <label row={1} text={lc('no_route')} color={$subtitleColor} visibility={items && items.length ? 'hidden' : 'visible'} textAlignment="center" verticalAlignment="middle" />
    </gridlayout>
</page>
