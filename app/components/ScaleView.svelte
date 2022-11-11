<script lang="ts">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { Screen } from '@nativescript/core/platform';
    import { executeOnMainThread } from '@nativescript/core/utils';
    import { convertDistance } from '~/helpers/formatter';
    import { getMapContext } from '~/mapModules/MapModule';
    import { TO_RAD } from '~/utils/geo';

    const mapContext = getMapContext();
    function getMetersPerPixel(pos: MapPos<LatLonKeys>, zoom: number) {
        return (156543.03392804097 * Math.cos(pos.lat * TO_RAD)) / Math.pow(2, zoom);
    }

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

        const newMpp = Math.round(getMetersPerPixel(cartoMap.focusPos, zoom) * 100) / 100;
        const metersPerCM = PX_PER_CM * newMpp;
        const data = convertDistance(metersPerCM);
        scaleText = `${data.value.toFixed(1)} ${data.unit} (${zoom.toFixed(1)})`;
        // });
    }
    mapContext.onMapReady((mapView: CartoMap<LatLonKeys>) => {
        updateData();
    });
    export function onLayoutChange() {
        scaleWidth = INCH_IN_CM * DPI;
        updateData();
    }
    mapContext.onMapMove((mapView: CartoMap<LatLonKeys>) => {
        updateData();
    });
</script>

<canvaslabel {...$$restProps} id="scale" width={scaleWidth} height={15}>
    <cspan fontSize={10} text={scaleText} fontWeight="bold" color="black" />
    <line strokeWidth={3} color="black" startX={0} startY="100%" stopX="100%" stopY="100%" paddingBottom={3} />
</canvaslabel>
