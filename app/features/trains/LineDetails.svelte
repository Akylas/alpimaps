<script context="module" lang="ts">
    // map, source and layer ids are global: a line's page opened from another one, which stays in the stack, must not clash with it
    let instances = 0;
</script>

<script lang="ts">
    import * as api from '@nativescript-community/ui-massifmaps/api';
    import type { MassifMap, MassifSource } from '@nativescript-community/ui-massifmaps/api';
    import { CollectionView, SnapPosition } from '@nativescript-community/ui-collectionview';
    import { Color, ObservableArray, Page } from '@nativescript/core';
    import dayjs from 'dayjs';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import CActionBar from '@shared/components/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { cloneLayerSpec, createTileDecoder, getMapContext } from '~/mapModules/MapModule';
    import { decompress, onNetworkChanged } from '~/services/NetworkService';
    import { packageService } from '~/services/PackageService';
    import DirectionHeader from '~/features/trains/DirectionHeader.svelte';
    import LineChip from '~/features/trains/LineChip.svelte';
    import { showStopLines } from '~/features/trains/stop';
    import type { StopLine } from '~/features/trains/lines';
    import { type TransitousLeg, type TransitousPlace, modeIcon, transitousService } from '~/features/trains/TransitousService';
    import { formatDuration } from '~/helpers/formatter';
    import { openURL } from '~/utils/ui/index.common';
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import { colors, fonts, windowInset } from '~/variables';
    import { geoJSONBounds } from '~/utils/geo';
    import IconButton from '~/components/common/IconButton.svelte';
    import type { Feature, FeatureCollection } from 'geojson';
    import type { MapPos } from '~/utils/geo';
    import { getDistanceSimple } from '~/helpers/geolib';
    $: ({ bottom: windowInsetBottom } = $windowInset);
    let { colorBackground, colorError, colorOnBackground, colorOnSurfaceVariant, colorPrimary } = $colors;
    $: ({ colorBackground, colorError, colorOnBackground, colorOnSurfaceVariant, colorPrimary } = $colors);
    interface Item {
        id: string;
        name: string;
        lat: number;
        lon: number;
        selected: boolean;
        /** when the next trip is at the stop, `HH:mm` */
        time: string | null;
        /** minutes behind the schedule */
        delay: number;
        color: string;
        first: boolean;
        last: boolean;
        /** the other kinds of transport that serve the stop */
        icons: string[];
        /** what makes this stop special for this trip */
        note: string | null;
        skipped: boolean;
    }
    /** a line of facts about the trip, under the header */
    interface Fact {
        icon: string;
        text: string;
        tone?: 'error' | 'primary';
        url?: string;
    }
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    export let line: StopLine;
    export let position: MapPos = null;
    /** the direction to show, an index of `line.directions` */
    export let directionIndex = 0;

    let massifMap: MassifMap;
    let lineDataSource: MassifSource<'massif::GeoJSONVectorTileDataSource'>;
    let selectedIndex = -1;
    $: lineColor = line.color ?? colorPrimary;

    let loading = false;
    let dataItems: ObservableArray<Item> = null;
    let facts: Fact[] = [];
    let noNetworkAndNoData = false;
    const instanceId = instances++;
    export let decoder = createTileDecoder('inner');
    const mapContext = getMapContext();

    function factColor(fact: Fact) {
        return fact.tone === 'error' ? colorError : fact.tone === 'primary' ? colorPrimary : colorOnSurfaceVariant;
    }
    function otherModeIcons(place: TransitousPlace) {
        return [...new Set((place.modes ?? []).filter((mode) => mode !== line.mode).map(modeIcon))].slice(0, 3);
    }
    // a stop the trip does not serve: cancelled today, or not a stop of the schedule
    function isSkipped(place: TransitousPlace) {
        return !!place.cancelled || (place.pickupType === 'NOT_ALLOWED' && place.dropoffType === 'NOT_ALLOWED');
    }
    function stopNote(place: TransitousPlace, index: number, count: number) {
        if (isSkipped(place)) {
            return lc('stop_not_served');
        }
        if (place.pickupType === 'NOT_ALLOWED' && index < count - 1) {
            return lc('no_boarding');
        }
        return place.dropoffType === 'NOT_ALLOWED' && index > 0 ? lc('no_alighting') : null;
    }
    function buildFacts(leg: TransitousLeg, stopsCount: number) {
        const result: Fact[] = [];
        if (leg.cancelled) {
            result.push({ icon: 'mdi-cancel', text: lc('cancelled'), tone: 'error' });
        } else if (leg.realTime) {
            result.push({ icon: 'mdi-access-point', text: lc('live'), tone: 'primary' });
        }
        result.push({ icon: 'mdi-timer-outline', text: `${formatDuration(leg.duration)} · ${lc('stops_count', stopsCount)}` });
        if (leg.wheelchairAccessible === 'ACCESSIBLE') {
            result.push({ icon: 'mdi-wheelchair-accessibility', text: lc('wheelchair_accessible') });
        } else if (leg.wheelchairAccessible === 'NOT_ACCESSIBLE') {
            result.push({ icon: 'mdi-wheelchair-accessibility', text: lc('wheelchair_not_accessible'), tone: 'error' });
        }
        if (leg.bikesAllowed) {
            result.push({ icon: 'mdi-bicycle', text: lc('bikes_allowed') });
        }
        if (leg.reservation === 'COMPULSORY') {
            result.push({ icon: 'mdi-calendar-alert', text: lc('reservation_required'), tone: 'error' });
        }
        if (leg.agencyName) {
            result.push({ icon: 'mdi-domain', text: leg.agencyName, url: leg.agencyUrl || undefined });
        }
        if (leg.agencyFareUrl) {
            result.push({ icon: 'mdi-ticket-outline', text: lc('get_tickets'), url: leg.agencyFareUrl });
        }
        return result;
    }
    async function refresh() {
        try {
            if (!massifMap) {
                return;
            }
            loading = true;
            const leg = await transitousService.getTrip(line.directions[directionIndex].tripId);
            const places = [leg.from, ...(leg.intermediateStops ?? []), leg.to];
            facts = buildFacts(leg, places.length);
            selectedIndex = -1;
            dataItems = new ObservableArray(
                places.map((place, index, array) => {
                    const selected = line.stopIds.includes(place.stopId) || (position && getDistanceSimple(place, position) < 50);
                    if (selected && selectedIndex === -1) {
                        selectedIndex = index;
                    }
                    const time = place.departure ?? place.arrival;
                    const delay = time ? Math.round((Date.parse(time) - Date.parse(place.scheduledDeparture ?? place.scheduledArrival ?? time)) / 60000) : 0;
                    return {
                        id: place.stopId,
                        name: place.name,
                        lat: place.lat,
                        lon: place.lon,
                        time: time ? dayjs(time).format('HH:mm') : null,
                        delay,
                        color: lineColor,
                        first: index === 0,
                        last: index === array.length - 1,
                        selected,
                        icons: otherModeIcons(place),
                        note: stopNote(place, index, array.length),
                        skipped: isSkipped(place)
                    };
                })
            );

            // no name or ref: the style would draw a shield on the line, the page's header says which line it is
            const path: Feature = {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: decompress(leg.legGeometry.points, leg.legGeometry.precision ?? 6).map(({ lat, lon }) => [lon, lat]) },
                properties: { route_id: line.id, route_color: lineColor, color: lineColor }
            };
            const lineGeoJSON: FeatureCollection = { type: 'FeatureCollection', features: [path] };
            dataItems.forEach((i) => {
                lineGeoJSON.features.unshift({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lon, i.lat] }, properties: { id: i.id, name: i.name, color: i.color } as any });
            });

            if (!lineDataSource) {
                lineDataSource = massifMap.source(`source.transitLine.${instanceId}`, { type: 'geojson', minZoom: 0, maxZoom: 24 });
                lineDataSource.createLayer('routes');
                massifMap.addLayer(`layer.transitLine.${instanceId}`, { type: 'vector', source: lineDataSource.id, style: decoder.id });
            }
            lineDataSource.setGeoJSON(1, lineGeoJSON);
            if (selectedIndex !== -1) {
                focusOnItem(dataItems.getItem(selectedIndex), true);
            } else {
                massifMap.camera().fitBounds(geoJSONBounds(lineGeoJSON), { integerZoom: true, resetRotation: true, resetTilt: true });
            }
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !dataItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }
    function reverseDirection() {
        directionIndex = (directionIndex + 1) % line.directions.length;
        refresh();
    }
    // onMount(() => {
    //     focus();
    // });
    function onNavigatingTo(e) {
        refresh();
    }
    async function onMapReady(e) {
        // its own registry id: two maps in one app must not share the "map" one
        massifMap = api.attach(e.object, { id: `map.transitLine.${instanceId}` });
        mapContext.setMapDefaultOptions(massifMap);
        try {
            let layers = mapContext.getLayers('map');
            if (layers.length === 0) {
                layers = mapContext.getLayers('customLayers');
            }
            layers.forEach((l, index) => {
                const spec = cloneLayerSpec(l.layer);
                if (spec) {
                    // its own composite, so it needs its own hillshade and contour children
                    mapContext.mapModule('customLayers')?.attachTerrain(massifMap.addLayer(`layer.transitLine.${instanceId}.base${index}`, spec));
                }
            });
            refresh();
        } catch (err) {
            showError(err);
        }
    }

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });

    async function showTimesheet() {
        try {
            const component = (await import('~/features/trains/LineTimesheet.svelte')).default;
            navigate({ page: component, props: { line, directionIndex } });
        } catch (error) {
            showError(error);
        }
    }
    function focusOnItem(item: Item, scrollToIndex = false) {
        // one move rather than a position animation racing a zoom animation
        massifMap.camera().moveTo({ lat: item.lat, lon: item.lon }, { zoom: 15, duration: 200 });
        decoder.call('setStyleParameters', { selected_id_str: item.id + '' });
        if (scrollToIndex) {
            collectionView.nativeView.scrollToIndex(dataItems.indexOf(item), false, SnapPosition.START);
        }
    }
    async function selectStop(item: Item) {
        try {
            DEV_LOG && console.log('selectStop', item.id);
            if (selectedIndex !== -1) {
                const oldItem = dataItems.getItem(selectedIndex);
                oldItem.selected = false;
                dataItems.setItem(selectedIndex, oldItem);
            }
            selectedIndex = dataItems.indexOf(item);
            item.selected = true;
            dataItems.setItem(selectedIndex, item);
            focusOnItem(item);
        } catch (error) {
            showError(error);
        }
    }
</script>

<page bind:this={page} actionBarHidden={true} on:navigatingTo={onNavigatingTo}>
    <gridlayout rows="auto,auto,auto,4*,6*">
        <CActionBar>
            <LineChip
                name={line.shortName || line.longName}
                slot="center"
                col={0}
                colSpan={3}
                color={line.color}
                fontSize={20}
                height={38}
                horizontalAlignment="center"
                mode={line.mode}
                textColor={line.textColor} />
            <IconButton text="mdi-calendar-clock-outline" on:tap={() => showTimesheet()} />
        </CActionBar>
        <DirectionHeader
            from={dataItems?.getItem(0)?.name ?? line.directions[directionIndex].headsign}
            row={1}
            swappable={line.directions.length > 1}
            to={dataItems?.getItem(dataItems.length - 1)?.name}
            on:tap={reverseDirection} />
        <wraplayout padding="0 16 8 16" row={2} visibility={facts.length ? 'visible' : 'collapse'}>
            {#each facts as fact}
                <stacklayout marginRight={16} orientation="horizontal" padding="2 0" rippleColor={colorPrimary} on:tap={() => fact.url && openURL(fact.url)}>
                    <label color={factColor(fact)} fontFamily={$fonts.mdi} fontSize={15} text={fact.icon} verticalAlignment="middle" />
                    <label color={factColor(fact)} fontSize={13} paddingLeft={4} text={fact.text} textDecoration={fact.url ? 'underline' : 'none'} verticalAlignment="middle" />
                </stacklayout>
            {/each}
        </wraplayout>
        <massifmap row={3} useTextureView={false} zoom={16} on:mapReady={onMapReady} />
        <collectionview bind:this={collectionView} items={dataItems} row={4} rowHeight={56} android:paddingBottom={windowInsetBottom + $windowInset.keyboard}>
            <Template let:item>
                <canvasview backgroundColor={item.selected ? new Color(colorPrimary).setAlpha(24).hex : null} columns="*,auto,auto" rippleColor={colorPrimary} on:tap={() => selectStop(item)}>
                    <line horizontalAlignment="left" startX={32} startY={0} stopX={32} stopY="50%" strokeColor={item.color} strokeWidth={5} visibility={item.first ? 'hidden' : 'visible'} />
                    <line horizontalAlignment="left" startX={32} startY="50%" stopX={32} stopY="100%" strokeColor={item.color} strokeWidth={5} visibility={item.last ? 'hidden' : 'visible'} />
                    <circle
                        antiAlias={true}
                        fillColor={item.first || item.last || item.selected ? item.color : colorBackground}
                        horizontalAlignment="left"
                        paddingLeft={32}
                        radius={item.selected ? 11 : 8}
                        strokeColor={item.color}
                        strokeWidth={4}
                        verticalAlignment="middle"
                        width={0} />
                    <stacklayout marginLeft={64} verticalAlignment="middle">
                        <label
                            color={item.selected ? colorPrimary : item.skipped ? colorOnSurfaceVariant : colorOnBackground}
                            fontSize={16}
                            fontWeight={item.selected ? 'bold' : 'normal'}
                            lineBreak="end"
                            maxLines={2}
                            text={item.name}
                            textDecoration={item.skipped ? 'line-through' : 'none'} />
                        <stacklayout orientation="horizontal" visibility={item.icons.length || item.note ? 'visible' : 'collapse'}>
                            {#each item.icons as icon}
                                <label color={colorOnSurfaceVariant} fontFamily={$fonts.mdi} fontSize={14} marginRight={4} text={icon} verticalAlignment="middle" />
                            {/each}
                            <label color={colorOnSurfaceVariant} fontSize={12} text={item.note} verticalAlignment="middle" visibility={item.note ? 'visible' : 'collapse'} />
                        </stacklayout>
                    </stacklayout>
                    <stacklayout col={1} horizontalAlignment="right" marginRight={8} verticalAlignment="middle" visibility={item.time ? 'visible' : 'collapse'}>
                        <label color={item.delay > 0 ? colorError : colorOnSurfaceVariant} fontSize={14} horizontalAlignment="right" text={item.time} />
                        <label color={colorError} fontSize={11} horizontalAlignment="right" text={`+${item.delay} min`} visibility={item.delay > 0 ? 'visible' : 'collapse'} />
                    </stacklayout>
                    <IconButton col={2} text="mdi-bus-clock" verticalAlignment="middle" on:tap={() => showStopLines(item.name, { lat: item.lat, lon: item.lon })} />
                </canvasview>
            </Template>
        </collectionview>
        <activityindicator busy={loading} row={4} verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
        {#if noNetworkAndNoData}
            <canvaslabel row={4}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                    <cspan fontSize={20} text={'\n' + lc('no_network')} />
                </cgroup>
            </canvaslabel>
        {/if}
    </gridlayout>
</page>
