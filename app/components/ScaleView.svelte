<script lang="ts">
    import { CartoMap } from '@nativescript-community/ui-carto/ui';
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { Screen } from '@nativescript/core/platform';
    import { convertDistance } from '~/helpers/formatter';
    import { getMapContext } from '~/mapModules/MapModule';

    const mapContext = getMapContext();
    function getMetersPerPixel(pos: MapPos<LatLonKeys>, zoom: number) {
        return (156543.03392804097 * Math.cos((pos.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    }

    const DPI = Screen.mainScreen.widthDIPs;
    const XDPI = DPI / Screen.mainScreen.scale;
    const PX_PER_CM = XDPI / 2.54;
    const INCH_IN_CM = 2.54;

    let scaleText = null;
    let scaleWidth = 80;
    function updateData() {
        const cartoMap = mapContext.getMap();
        if (!cartoMap) {
            return;
        }
        const zoom = cartoMap.zoom;

        const newMpp = Math.round(getMetersPerPixel(cartoMap.focusPos, zoom) * 100) / 100;
        const metersPerCM = PX_PER_CM * newMpp;
        const data = convertDistance(metersPerCM);
        scaleText = `${data.value.toFixed(1)} ${data.unit}(${zoom.toFixed(1)})`;
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

<canvaslabel
    {...$$restProps}
    id="scale"
    width={scaleWidth}
    height="15">
    <cspan fontSize="10" text={scaleText} fontWeight="bold" color="black" />
    <line strokeWidth="3" color="black" startX="0" startY="100%" stopX="100%" stopY="100%" paddingBottom="3"/>
</canvaslabel>
