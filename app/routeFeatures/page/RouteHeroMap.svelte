<script lang="ts">
    // the route page's own small map: the main map's base, the route in the inner style and a cursor, nothing else
    import * as api from '@nativescript-community/ui-massifmaps/api';
    import type { MassifMap, MassifObject, MassifSource } from '@nativescript-community/ui-massifmaps/api';
    import { Color, Utils } from '@nativescript/core';
    import { createEventDispatcher } from '@shared/utils/svelte/ui';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import type { MassifMap as MassifMapView } from '@nativescript-community/ui-massifmaps/ui';
    import { onDestroy } from 'svelte';
    import { get } from 'svelte/store';
    import { isEInk } from '~/helpers/theme';
    import { cloneLayerSpec, getMapContext } from '~/mapModules/MapModule';
    import { getUserBitmapUrl } from '~/mapModules/UserLocationModule';
    import type { IItem } from '~/models/Item';
    import { clearSection, focusKeyOf, routeFocus } from '~/routeFeatures/lens/routeFocusStore';
    import { routeCoordinates } from '~/routeFeatures/lens/sections';
    import { routeFeatureChanges, routeFeatures, routeMapFeatures } from '~/routeFeatures/registry';
    import { geometryBounds, toBounds, toPosition } from '~/utils/geo';
    import { colors } from '~/variables';

    export let item: IItem;

    interface $$Events {
        /** the map could not be made: the page goes on without it */
        failed: undefined;
    }
    const dispatch = createEventDispatcher<$$Events>();

    const HERO_TILE_CACHE = 16 * 1024 * 1024;
    const FIT_MARGIN = 16;
    const ROUTE_LAYER = 1;
    const LENS_LAYER = 2;

    $: ({ colorOnSurface, colorPrimary } = $colors);

    const mapContext = getMapContext();
    let massifMap: MassifMap;
    let source: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    // an element moved in place: no tile of the map is made again
    let cursorMarker: MassifObject<'massif::Point'>;
    // what the map made out of the main map's layers, released with it
    const owned: MassifObject[] = [];

    function onMapReady(event) {
        try {
            massifMap = api.attach(event.object, { id: 'map.routeHero' });
            mapContext.setMapDefaultOptions(massifMap);
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            // the main map's base on a small tile cache; its terrain sources are the main map's, already cached
            layers.forEach((added, index) => {
                const spec = cloneLayerSpec(added.layer, owned);
                if (spec?.type === 'composite-vector') {
                    mapContext.mapModule('customLayers')?.attachTerrain(massifMap.addLayer(`layer.routeHero.base${index}`, { ...spec, tileCacheCapacity: HERO_TILE_CACHE }));
                } else if (spec?.type === 'vector') {
                    massifMap.addLayer(`layer.routeHero.base${index}`, { ...spec, tileCacheCapacity: HERO_TILE_CACHE });
                } else if (spec) {
                    massifMap.addLayer(`layer.routeHero.base${index}`, spec);
                }
            });
            source = massifMap.source('source.routeHero', { type: 'geojson', simplifyTolerance: 2, minZoom: 0, maxZoom: 24 });
            source.createLayer('items');
            source.createLayer('poi');
            createCursor();
            massifMap.addLayer('layer.routeHero', {
                type: 'vector',
                source: source.id,
                style: mapContext.innerDecoder.id,
                labelBlendingSpeed: 0,
                layerBlendingSpeed: 0,
                labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST'
            });
            drawRoute();
            drawLens();
            drawCursor(cursorIndex);
            if (massifMap.size().width) {
                frame();
            }
        } catch (error) {
            console.error('RouteHeroMap', error, error.stack);
            dispatch('failed');
        }
    }

    function drawRoute() {
        if (!source || !item?.geometry) {
            return;
        }
        // selected on its own: on this map there is nothing else to pick
        source.setGeoJSON(ROUTE_LAYER, { type: 'FeatureCollection', features: [{ type: 'Feature', id: item.id, properties: { ...item.properties, selected: 1 }, geometry: item.geometry }] });
    }
    function drawLens() {
        source?.setGeoJSON(LENS_LAYER, { type: 'FeatureCollection', features: routeMapFeatures(get(routeFeatures), { item, navigating: false }) });
    }

    $: itemKey = focusKeyOf(item);
    $: focus = $routeFocus?.itemKey === itemKey ? $routeFocus : null;
    $: cursorIndex = focus?.cursor?.index;
    $: section = focus?.section;

    // the main map's selection dot, hidden until a point is picked. A point, not the main map's marker: a billboard
    // draws over every layer, a point in its layer's place, here under the route
    function createCursor() {
        const markerSource = massifMap.source('source.routeHero.cursor', { type: 'local', projection: { type: 'EPSG:4326' } });
        const color = new Color(isEInk ? colorOnSurface : colorPrimary).setAlpha(isEInk ? 255 : 178).hex;
        cursorMarker = massifMap.object('element', 'element.routeHero.cursor', {
            type: 'point',
            position: toPosition({ lat: 0, lon: 0 }),
            visible: false,
            style: { type: 'point', size: 20, clickSize: 0, bitmap: { type: 'url', url: getUserBitmapUrl('dot', color, color) } }
        });
        markerSource.call('add', cursorMarker.handle);
        massifMap.addLayer('layer.routeHero.cursor', { type: 'elements', source: markerSource.id });
    }
    function drawCursor(index: number | undefined) {
        const position = index !== undefined ? routeCoordinates(item.geometry)[index] : undefined;
        if (!cursorMarker) {
            return;
        }
        if (position) {
            // the whole geometry: PointGeometry's `pos` is read-only
            cursorMarker.set('geometry', { type: 'point', pos: toPosition({ lat: position[1], lon: position[0] }) });
        }
        cursorMarker.set('visible', !!position);
    }
    // the map follows the point picked on the profile, as the main map does, at the zoom it is at
    $: if (massifMap) {
        drawCursor(cursorIndex);
        followCursor(cursorIndex);
    }
    function followCursor(index: number | undefined) {
        const position = index !== undefined ? routeCoordinates(item.geometry)[index] : undefined;
        if (massifMap && position) {
            massifMap.camera().moveTo({ lat: position[1], lon: position[0] }, { duration: isEInk ? 0 : 100 });
        }
    }
    $: if (source && $routeFeatureChanges >= 0) {
        drawLens();
    }
    $: if (source && item) {
        drawRoute();
    }

    // the focused section, else the whole route
    function frame(whole = false) {
        if (!massifMap || !item?.geometry) {
            return;
        }
        const { height, width } = massifMap.size();
        if (!width) {
            return;
        }
        const margin = Utils.layout.toDevicePixels(FIT_MARGIN);
        const screen = { min: { x: margin, y: margin }, max: { x: width - margin, y: height - margin } };
        const coordinates = routeCoordinates(item.geometry);
        const geometry = section && !whole ? { type: 'LineString' as const, coordinates: coordinates.slice(section.i0, section.i1 + 1) } : item.geometry;
        massifMap.camera().fitBounds(toBounds(geometryBounds(geometry)), { screen, resetRotation: true, duration: isEInk ? 0 : 200 });
    }
    let sectionKey = '';
    $: {
        const key = section ? `${section.i0}:${section.i1}` : '';
        if (key !== sectionKey) {
            sectionKey = key;
            frame();
        }
    }

    /** The whole route again, the focused section left. */
    export function showWholeRoute() {
        clearSection();
        frame(true);
    }

    let mapView: NativeViewElementNode<MassifMapView>;
    /** The native map view, for the page to hand it the touches its list catches over the map. */
    export function touchTarget() {
        return mapView?.nativeView?.nativeViewProtected;
    }

    function release(what: string, run: () => void) {
        try {
            run();
        } catch (error) {
            console.error('RouteHeroMap release', what, error);
        }
    }
    /**
     * Before the view goes: the page calls it as it is left. The layers first, while the view is there: they share the
     * main map's sources, which would keep them, and their tile caches, once the view is gone.
     */
    export function dispose() {
        if (!massifMap) {
            return;
        }
        const map = massifMap;
        massifMap = null;
        cursorMarker = null;
        source = null;
        if (mapView?.nativeView?.nativeViewProtected) {
            release('layers', () => map.layers().clear());
        }
        owned.forEach((object) => release('source', () => object.destroy()));
        owned.length = 0;
        release('map', () => map.destroy());
    }
    onDestroy(dispose);
</script>

<gridlayout {...$$restProps}>
    <!-- a TextureView: a surface view would draw over the list that slides over it -->
    <massifmap bind:this={mapView} useTextureView={true} zoom={12} on:mapReady={onMapReady} on:layoutChanged={() => frame()} />
</gridlayout>
