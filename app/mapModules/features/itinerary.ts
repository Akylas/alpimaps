import type { MassifLayer, MassifSource } from '@nativescript-community/ui-massifmaps/api';
import { closeBottomSheet, showBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
import { ApplicationSettings, ObservableArray } from '@nativescript/core';
import dayjs from 'dayjs';
import { get, writable } from 'svelte/store';
import { showError } from '@shared/utils/showError';
import { lc } from '~/helpers/locale';
import { getMapContext } from '~/mapModules/MapModule';
import { type DirectionsPlace, registerMapFeature } from '~/mapModules/mapFeatures';
import type { IItem } from '~/models/Item';
import { decompress } from '~/services/NetworkService';
import type { TransitousItinerary, TransitousLeg } from '~/services/TransitousService';
import { type TransitHistoryEntry, transitHistory } from '~/stores/historyStore';
import type { MapPos } from '~/utils/geo';
import { geoJSONBounds } from '~/utils/geo';
import { TRANSIT_SHEET_DETENTS, TRANSIT_SHEET_PEEK_HEIGHT } from '~/utils/ui/transitSheet';

const WALK_COLOR = '#808080';
const DEFAULT_COLOR = '#3F51B5';
/**
 * The drawn legs have their own id and the selected item another: a leg whose id matches the selection is drawn in the
 * style's selection blue, and the legs keep the colour of their line.
 */
const ITINERARY_ID = 20260101;
const SELECTED_ITINERARY_ID = 20260102;
const ITINERARY_TITLE = 'itinerary';

let dataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
let layer: MassifLayer<'massif::VectorTileLayer'>;

/** What the itineraries sheet shows, kept so it can come back after being hidden to look at the map. */
export interface ItinerarySession {
    from: { name: string; position: MapPos };
    to: { name: string; position: MapPos };
    time: Date | null;
    arriveBy: boolean;
    itineraries: TransitousItinerary[];
    selected?: TransitousItinerary;
}
let session: ItinerarySession;
/** what is drawn, so a tap on it can select it */
let displayed: { itinerary: TransitousItinerary; title: string; subtitle?: string };

export function rememberItinerarySession(value: ItinerarySession) {
    session = value;
}

function legColor(leg: TransitousLeg) {
    if (leg.mode === 'WALK' || leg.mode === 'BIKE' || leg.mode === 'CAR') {
        return WALK_COLOR;
    }
    return leg.routeColor ? `#${leg.routeColor}` : DEFAULT_COLOR;
}

function legCoordinates(leg: TransitousLeg) {
    return decompress(leg.legGeometry.points, leg.legGeometry.precision ?? 6).map(({ lat, lon }) => [lon, lat]);
}

/** The `directions` layer of the map style, drawn like the routes the panel computes: same width, arrows, selection. */
export function showItineraryOnMap(itinerary: TransitousItinerary, { fit = true, title = ITINERARY_TITLE, subtitle }: { fit?: boolean; title?: string; subtitle?: string } = {}) {
    const mapContext = getMapContext();
    clearItineraryLayer();
    const features: GeoJSON.Feature[] = itinerary.legs
        .filter((leg) => leg.legGeometry)
        .map((leg) => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: legCoordinates(leg) },
            properties: {
                id: ITINERARY_ID,
                class: 'transit',
                style: { color: legColor(leg) }
            }
        }));
    if (!features.length) {
        return;
    }
    const collection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };
    dataSource = mapContext.getMap().source('source.itinerary', { type: 'geojson', minZoom: 0, maxZoom: 24 });
    dataSource.createLayer('directions');
    dataSource.setGeoJSON(1, collection);
    layer = mapContext.getMap().buildLayer('layer.itinerary', {
        type: 'vector',
        source: dataSource.id,
        style: mapContext.innerDecoder.id,
        layerBlendingSpeed: 0,
        labelBlendingSpeed: 0,
        labelRenderOrder: 'VECTOR_TILE_RENDER_ORDER_LAST',
        clickRadius: ApplicationSettings.getNumber('route_click_radius', 16)
    });
    layer.onFeatureClick((event) => {
        if (displayed) {
            event.consumed = true;
            focusItinerary(displayed.itinerary, displayed.title, displayed.subtitle);
        }
    });
    mapContext.addLayer(layer, 'search');
    displayed = { itinerary, title, subtitle };

    if (fit) {
        const viewPort = mapContext.getMapViewPort();
        const screen = {
            min: { x: viewPort.left, y: viewPort.top },
            max: { x: viewPort.left + viewPort.width, y: viewPort.top + viewPort.height - TRANSIT_SHEET_PEEK_HEIGHT }
        };
        mapContext.getMap().camera().fitBounds(geoJSONBounds(collection), { screen, duration: 200 });
    }
}

/**
 * Hides the itineraries sheet to look at the journey, or one of its legs: it is drawn, zoomed to and selected like a
 * line, and the selected item has an action to bring the sheet back.
 */
export async function focusItinerary(itinerary: TransitousItinerary, title: string, subtitle?: string) {
    try {
        showItineraryOnMap(itinerary, { fit: false, title, subtitle });
        const coordinates = itinerary.legs.filter((leg) => leg.legGeometry).flatMap(legCoordinates);
        closeBottomSheet();
        await getMapContext().selectItem({
            item: {
                geometry: { type: 'LineString', coordinates },
                properties: { id: SELECTED_ITINERARY_ID, name: title, subtitle, itinerary: true },
                route: { osmid: itinerary.legs.find((leg) => leg.tripId)?.tripId ?? title, type: 'transit' }
            },
            isFeatureInteresting: true,
            showButtons: true
        });
    } catch (error) {
        showError(error);
    }
}

export async function reopenItineraries() {
    if (!session) {
        return;
    }
    try {
        getMapContext().unselectItem();
        const ItinerariesBottomSheet = (await import('~/components/transit/ItinerariesBottomSheet.svelte')).default;
        await showBottomSheet({
            parent: getMapContext().getMainPage(),
            trackingScrollView: 'scrollView',
            detents: TRANSIT_SHEET_DETENTS,
            initialDetentIndex: 0,
            view: ItinerariesBottomSheet,
            props: { from: session.from, to: session.to, time: session.time, arriveBy: session.arriveBy, initialItineraries: session.itineraries, initialSelected: session.selected }
        });
    } catch (error) {
        showError(error);
    }
}

function clearItineraryLayer() {
    displayed = null;
    if (layer) {
        getMapContext().removeLayer(layer, 'search');
        layer.destroy();
        layer = null;
    }
    if (dataSource) {
        dataSource.deleteLayer(1);
        dataSource = null;
    }
}

/** the journey leaves the map for good: the sheet cannot come back either */
export function clearItineraryFromMap() {
    session = null;
    clearItineraryLayer();
}

/** The journey's time, `null` for now. The options pills edit them, the request reads them. */
export const journeyTime = writable<Date | null>(null);
export const journeyArriveBy = writable(false);

async function computeJourney({ from, to }: { from: DirectionsPlace; to: DirectionsPlace }) {
    clearItineraryFromMap();
    const ItinerariesBottomSheet = (await import('~/components/transit/ItinerariesBottomSheet.svelte')).default;
    showBottomSheet({
        parent: getMapContext().getMainPage(),
        trackingScrollView: 'scrollView',
        detents: TRANSIT_SHEET_DETENTS,
        initialDetentIndex: 0,
        view: ItinerariesBottomSheet,
        props: { from, to, time: get(journeyTime), arriveBy: get(journeyArriveBy) }
    });
}

function historySubtitle({ arriveBy, time }: TransitHistoryEntry) {
    return time ? `${lc(arriveBy ? 'arrive_by' : 'depart_at')} ${dayjs(time).format('ddd D MMM HH:mm')}` : lc('now');
}

function restoreJourney({ arriveBy, from, time, to }: TransitHistoryEntry) {
    const departure = time ? new Date(time) : null;
    getMapContext().mapModules.directionsPanel.setPlaces([from, to], 'journey');
    journeyTime.set(departure);
    journeyArriveBy.set(arriveBy);
    // a trip in the past would only give back what has already left
    if (!departure || departure.getTime() > Date.now()) {
        getMapContext().mapModules.directionsPanel.computeMode();
    }
}

async function showJourneyHistory() {
    try {
        const OptionSelect = (await import('~/components/common/OptionSelect.svelte')).default;
        const options = new ObservableArray(
            get(transitHistory).map((entry) => ({
                title: `${entry.from.name} → ${entry.to.name}`,
                subtitle: historySubtitle(entry),
                rightIcon: 'mdi-close',
                data: entry
            }))
        );
        const results = await showBottomSheet({
            parent: null,
            view: OptionSelect,
            skipCollapsedState: true,
            props: {
                height: Math.min(460, 80 + 64 * options.length),
                title: lc('transit_history'),
                titleIcon: 'mdi-history',
                rowHeight: 64,
                options,
                onRightIconTap: (item) => {
                    transitHistory.remove(item.data);
                    options.splice(options.indexOf(item), 1);
                }
            }
        });
        const entry: TransitHistoryEntry = (Array.isArray(results) ? results[0] : results)?.data;
        if (entry) {
            restoreJourney(entry);
            // closing the sheet hands the focus back to the search field
            getMapContext().unFocusSearch();
        }
    } catch (error) {
        showError(error);
    }
}

const isItinerary = (item: IItem) => !!session && !!item?.properties?.itinerary;

registerMapFeature({
    id: 'itinerary',
    claimsItem: (item) => !!item?.properties?.itinerary,
    leadingActions: (item) => (isItinerary(item) ? ['itineraries'] : []),
    itemActions: (item) => (isItinerary(item) ? [{ id: 'itineraries', text: 'mdi-transit-connection-variant', tooltip: lc('itineraries'), order: 5, main: true, onTap: reopenItineraries }] : []),
    directionsModes: [
        {
            id: 'journey',
            icon: 'mdi-train',
            options: () => import('~/components/transit/JourneyOptions.svelte'),
            history: { items: transitHistory, show: showJourneyHistory },
            compute: computeJourney,
            clear: clearItineraryFromMap
        }
    ]
});
