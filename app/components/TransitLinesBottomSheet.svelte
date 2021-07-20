<script lang="ts">
    import { MapPos } from '@nativescript-community/ui-carto/core';

    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import dayjs from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, showModal } from 'svelte-native/dom';
import { transitService } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { borderColor, navigationBarHeight } from '~/variables';

    export let position: MapPos<LatLonKeys>;
    export let name: string;

    let selectedPageIndex = 0;
    let loading = false;
    let collectionViewLines: NativeViewElementNode<CollectionView>;
    let collectionViewTimeline: NativeViewElementNode<CollectionView>;
    let linesItems: any[] = null;
    let timelineItems: any[] = null;

    async function refreshLines() {
        try {
            loading = true;
            const lines = await transitService.getMetroLinesData();
            const positionData = await transitService.findBusStop(position);
            const linesData = positionData.reduce((acc, d) => {
                d.lines.forEach((l) => {
                    if (!acc[l]) {
                        acc[l] = { ...lines[l], stopIds: [d.id], position: { lat: d.lat, lon: d.lon }, id: l };
                    } else {
                        acc[l].stopIds.push(d.id);
                    }
                });
                return acc;
            }, {});
            linesItems = Object.values(linesData);
        } catch (error) {
            showError(error);
        } finally {
            loading = false;
        }
    }

    let prevTime = null;
    let nextTime = null;
    let lineData = null;

    let lineDataIndex = 0;
    async function fetchLineTimeline(item, time?) {
        try {
            loading = true;
            lineData = await transitService.getLineTimeline(item.id, time);
            prevTime = lineData[lineDataIndex].prevTime;
            nextTime = lineData[lineDataIndex].nextTime;
            timelineItems = lineData[lineDataIndex].arrets;
            currentStopId = item.stopIds[lineDataIndex];
            const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
            if (index === -1) {
                item.stopIds = item.stopIds.reverse();
                currentStopId = item.stopIds[lineDataIndex];
            }
            const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
            console.log(
                item.stopIds,
                Object.keys(lineData[lineDataIndex]),
                currentStopId,
                'scrollIndex',
                scrollIndex,
                timelineItems.map((s) => s.stopId)
            );
            collectionViewTimeline.nativeView.scrollToIndex(scrollIndex, false);
        } catch (error) {
            showError(error);
        } finally {
            loading = false;
        }
    }

    let currentTime = null;
    let currentStopId = null;
    async function showDetails(item) {
        const component = (await import('./TransitTimesheet.svelte')).default;
        showModal({
            page: component,
            fullscreen: true,
            props: {
                line: item
            }
        });

        // currentTime = dayjs().valueOf();
        // fetchLineTimeline(item, currentTime);
        // selectedPageIndex = 1;
    }

    function getTripTime(item, index) {
        const data = item.trips[index];
        if (typeof data === 'string') {
            return data;
        }
        if (index) {
            return dayjs().startOf('d').add(data, 's').format('LT');
        }
        return '|';
    }

    onMount(() => {
        console.log('test', position, name);
        refreshLines();
    });
</script>

<gridlayout rows="auto,*" class="bottomsheet" height="200">
    <label text={name} fontWeight="bold" padding="15 10 15 20" fontSize="20" />
    <pager row={1} disableSwipe={false} bind:selectedIndex={selectedPageIndex}>
        <pageritem>
            <collectionview bind:this={collectionViewLines} items={linesItems} itemIdGenerator={(item, i) => i} android:marginBottom={navigationBarHeight} rowHeight="70">
                <Template let:item>
                    <gridlayout rippleColor={item.color} columns="auto,*,auto" padding={10} on:tap={() => showDetails(item)}>
                        <label
                            borderRadius={4}
                            width={50}
                            height={50}
                            backgroundColor={item.color}
                            color={item.textColor}
                            text={item.shortName}
                            fontSize={20}
                            autoFontSize={true}
                            textAlignment="center"
                            verticalTextAlignment="center"
                            padding={4}
                        />
                        <label text={item.longName} col={1} fontSize={17} paddingLeft={10} verticalAlignment="center" maxLines={2} autoFontSize={true} lineBreak="end" />
                        <button col={2} variant="text" class="icon-btn" text="mdi-information-outline" />
                    </gridlayout>
                </Template>
            </collectionview>
        </pageritem>
        <pageritem>
            <collectionview bind:this={collectionViewTimeline} items={timelineItems} itemIdGenerator={(item, i) => i} android:marginBottom={navigationBarHeight} rowHeight="50">
                <Template let:item>
                    <gridlayout rippleColor={item.color} columns="*,100" padding={4} borderBottomColor={borderColor}>
                        <label text={item.stopName} maxFontSize={13} fontSize={13} autoFontSize={true} verticalTextAlignment="center" />
                        <canvaslabel col="1" fontSize={12} verticalTextAlignment="center">
                            <cspan text={getTripTime(item, 0)} textAlignment="left" />
                            <cspan text={getTripTime(item, 1)} textAlignment="center" />
                            <cspan text={getTripTime(item, 2)} textAlignment="right" />
                        </canvaslabel>
                    </gridlayout>
                </Template>
            </collectionview>
        </pageritem>
    </pager>
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} busy={true} horizontalAlignment="center" verticalAlignment="center" />
</gridlayout>
