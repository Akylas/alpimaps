import { GeoJSONVectorTileDataSource } from '@nativescript-community/ui-carto/datasources';
import { TileSubstitutionPolicy } from '@nativescript-community/ui-carto/layers';
import { VectorTileLayer, VectorTileRenderOrder } from '@nativescript-community/ui-carto/layers/vector';
import { Color } from '@nativescript/core';
import { showError } from '@shared/utils/showError';
import { navigate } from '@shared/utils/svelte/ui';
import { closePopover } from '@nativescript-community/ui-popover/svelte';
import { derived, get, writable } from 'svelte/store';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import { FeaturePicker, isPickerPending } from '~/mapModules/featurePicker';
import { registerMapFeature } from '~/mapModules/mapFeatures';
import type { IItem } from '~/models/Item';
import { transitService } from '~/services/TransitService';
import { preloading } from '~/stores/mapStore';
import { colors } from '~/variables';

/** Whether the transit overlay is on. Toggled from the map's overflow menu. */
const showingTransitLines = writable(false);

let dataSource: GeoJSONVectorTileDataSource;
let transitLayer: VectorTileLayer;
let fetching = false;

const transitPicker = new FeaturePicker({
    id: 'transit',
    key: (item) => item.properties.id,
    label: (item) => item.properties.name,
    select: (item) => getMapContext().selectItem({ item, isFeatureInteresting: true, showButtons: true }),
    // shortest code first, then alphabetically: line numbers read as a list that way
    sort: (first, second) => {
        const firstShort = first.properties.shortName;
        const secondShort = second.properties.shortName;
        if (firstShort.length === secondShort.length) {
            return firstShort > secondShort ? 1 : -1;
        }
        return firstShort.length - secondShort.length;
    },
    closeOpenSheet: true
});

/** True while a transit tap is being resolved, so the map leaves the click alone. */
export function isTransitPickerPending() {
    return isPickerPending('transit');
}

function onTransitTileClicked({ featureData, featureGeometry, featureId, featureLayerName }) {
    // a tap on a road that also carries transit belongs to the road
    if (isPickerPending('routes')) {
        return;
    }
    if (featureLayerName !== 'routes') {
        return;
    }
    const id = featureData.route_id || featureData.id || featureId;
    const color = featureData['route_color']?.length ? featureData['route_color'] : transitService.defaultTransitLineColor;
    const agency = featureData['agency_id'];
    const textColor = new Color(color).getBrightness() >= 186 ? '#000000' : '#ffffff';
    transitPicker.add({
        properties: {
            class: 'bus',
            id,
            ref: featureData['route_short_name'],
            subtitle: featureData['agency_name'],
            name: featureData['route_long_name'],
            symbol: `${color}:${color}:${agency === 'FLIXBUS-eu' ? 'FLIX' : featureData['route_short_name']}:${textColor}`,
            layer: featureLayerName,
            ...featureData
        },
        route: { osmid: id } as any,
        _nativeGeometry: featureGeometry,
        layer: transitLayer
    } as IItem);
    return false;
}

/** The layer holds a decoder that gets rebuilt on style changes, so it is rebuilt with it. */
function updateTransitLayer() {
    const oldLayer = transitLayer;
    transitLayer = null;
    createTransitLayer(false);
    getMapContext().replaceLayer(oldLayer, transitLayer);
}

function createTransitLayer(add = true) {
    const mapContext = getMapContext();
    transitLayer = new VectorTileLayer({
        visibleZoomRange: [7, 24],
        layerBlendingSpeed: 3,
        labelBlendingSpeed: 3,
        preloading: get(preloading),
        tileSubstitutionPolicy: TileSubstitutionPolicy.TILE_SUBSTITUTION_POLICY_VISIBLE,
        labelRenderOrder: VectorTileRenderOrder.LAST,
        dataSource,
        decoder: mapContext.innerDecoder
    });
    mapContext.innerDecoder.once('change', updateTransitLayer);
    transitLayer.setVectorTileEventListener<LatLonKeys>({ onVectorTileClicked: onTransitTileClicked }, mapContext.getProjection());
    mapContext.innerDecoder.setStyleParameter('default_transit_color', transitService.defaultTransitLineColor);
    if (add) {
        mapContext.addLayer(transitLayer, 'transit');
    }
}

async function showTransitLines() {
    try {
        if (transitLayer) {
            transitLayer.visible = true;
            return;
        }
        if (fetching) {
            return;
        }
        fetching = true;
        const result = await transitService.getTransitLines();
        if (!dataSource) {
            dataSource = new GeoJSONVectorTileDataSource({ minZoom: 0, maxZoom: 24 });
            dataSource.createLayer('routes');
        }
        dataSource.setLayerGeoJSONString(1, result);
        if (!transitLayer) {
            createTransitLayer();
        }
    } catch (error) {
        showingTransitLines.set(false);
        showError(error);
    } finally {
        fetching = false;
    }
}

showingTransitLines.subscribe((showing) => {
    if (showing) {
        showTransitLines();
    } else if (transitLayer) {
        transitLayer.visible = false;
    }
});

/**
 * The overlay can be switched on before the map reports ready, in which case the layer exists but was
 * never added. The map calls this once it has a map to add it to.
 */
export function addTransitLayerIfPending() {
    if (transitLayer) {
        getMapContext().addLayer(transitLayer, 'transit');
    }
}

const showTransitLinesPage = async () => {
    try {
        closePopover();
        const component = (await import('~/components/transit/TransitLines.svelte')).default;
        navigate({ page: component });
    } catch (error) {
        showError(error);
    }
};

registerMapFeature({
    id: 'transit',
    enabled: () => WITH_BUS_SUPPORT,
    menuItems: derived([showingTransitLines, colors], ([$showingTransitLines, $colors]) =>
        // dev-only: the transit data is not shipped
        getMapContext().mapModule('customLayers')?.devMode
            ? [
                  {
                      id: 'transit_lines',
                      title: lc('show_transit_lines'),
                      icon: 'mdi-bus-marker',
                      menu: 'overflow' as const,
                      color: $showingTransitLines ? $colors.colorPrimary : undefined,
                      run: () => showingTransitLines.set(!get(showingTransitLines)),
                      onLongPress: showTransitLinesPage
                  }
              ]
            : []
    )
});
