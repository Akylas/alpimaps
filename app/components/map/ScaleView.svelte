<script lang="ts">
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { Screen } from '@nativescript/core/platform';
    import { convertDistance } from '~/helpers/formatter';
    import { getMetersPerPixel } from '~/helpers/geolib';
    import { getMapContext } from '~/mapModules/MapModule';

    const mapContext = getMapContext();

    const DPI = Screen.mainScreen.widthDIPs;
    const XDPI = DPI / Screen.mainScreen.scale;
    const PX_PER_CM = XDPI / 2.54;
    const INCH_IN_CM = 2.54;

    let scaleText = null;
    let scaleWidth = 80;
    let currentZoom;
    function updateData() {
        // executeOnMainThread(() => {
        const cartoMap = mapContext.getMap();
        if (!cartoMap) {
            return;
        }
        const zoom = cartoMap.zoom;
        if (currentZoom === zoom) {
            return;
        }
        const newMpp = getMetersPerPixel(cartoMap.focusPos, zoom);
        const metersPerCM = PX_PER_CM * newMpp;
        const data = convertDistance(metersPerCM);
        scaleText = `${data.value.toFixed(data.value < 10 ? 1 : 0)} ${data.unit} (${zoom.toFixed(1)})`;
        // });
    }
    mapContext.onMapReady(() => {
        updateData();
    });
    export function onLayoutChange() {
        scaleWidth = INCH_IN_CM * DPI;
        updateData();
    }
    mapContext.onMapMove(() => {
        updateData();
    });
</script>

<canvaslabel {...$$restProps} id="scale" height={15} width={scaleWidth}>
    <cspan color="black" fontSize={10} fontWeight="bold" text={scaleText} />
    <line color="black" paddingBottom={3} startX={0} startY="100%" stopX="100%" stopY="100%" strokeWidth={3} />
</canvaslabel>
