<script lang="ts" context="module">
    export interface OptionType {
        name: string;
        data?: string;
    }
</script>

<script lang="ts">
    import { Template } from 'svelte-native/components';
    import ListItem from './ListItem.svelte';
    import { closeModal } from 'svelte-native';
    import { closeBottomSheet } from './bottomsheet';
    import { Canvas, CanvasView, Paint } from '@nativescript-community/ui-canvas';
    import { BaseVectorTileLayer } from '@nativescript-community/ui-carto/layers/vector';
    import { osmicon } from '~/helpers/formatter';

    export let options: OptionType[];

    function close(value?: OptionType) {
        closeBottomSheet(value);
    }

    function onTap(item: OptionType, args) {
        close(item);
    }

    const paint = new Paint();
    paint.setFontFamily('osm');
    paint.setTextSize(34);
    // function onDraw({ canvas, object, item }: { canvas: Canvas; object: CanvasView; item }) {
    //     //red:white:red_lower:549:black
    //     const route = item.route;
    //     if (route.featureData.symbol) {
    //         const array = route.featureData.symbol.split(':');
    //         const length = array.length;
    //         paint.setColor(array[1]);
    //         canvas.drawRect(16, 19, 50, 48, paint);
    //         if (length > 2) {
    //             const foreground = array[2];
    //             const foregroundArray = foreground.split('_');
    //             const color = foregroundArray.length > 1 ? foregroundArray[0] : 'white';
    //             paint.setColor(color);
    //             const shape = foregroundArray[foregroundArray.length - 1];
    //             let icon = osmicon('symbol-' + shape);
    //             if (icon) {
    //                 canvas.drawText(icon, 0, 1, 16, 48, paint);
    //             }
    //         }
    //     } else if (route.featureData.color) {
    //         paint.setColor(route.featureData.color);
    //         canvas.drawRect(16, 16, 50, 50, paint);
    //     }
    // }
</script>

<collectionView items={options} rowHeight="72" height="200">
    <Template let:item>
        <ListItem
            title={item.name}
            subtitle={item.route.featureData.ref}
            showBottomLine
            extraPaddingLeft={44}
            on:tap={(event) => onTap(item, event)}
            showSymbol
            symbol={item.route.featureData.symbol || 0}
            symbolColor={item.route.featureData.color || 0} />
    </Template>
</collectionView>
