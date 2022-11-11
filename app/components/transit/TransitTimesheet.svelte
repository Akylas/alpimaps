<script lang="ts">
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { showSnack } from '@nativescript-community/ui-material-snackbar';
    import { Page } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import dayjs, { Dayjs } from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import CActionBar from '~/components/CActionBar.svelte';
    import { lc } from '~/helpers/locale';
    import { onThemeChanged } from '~/helpers/theme';
    import { NoNetworkError, onNetworkChanged } from '~/services/NetworkService';
    import { transitService } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { pickDate, pickTime } from '~/utils/utils';
    import { accentColor, borderColor, mdiFontFamily, navigationBarHeight, subtitleColor, textColor } from '~/variables';
    import IconButton from '../IconButton.svelte';

    export let line: any;
    let loading = false;
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let noNetworkAndNoData = false;
    let timelineItems: any[] = null;
    let lineData = null;
    let lineDataIndex = 0;
    let directionText: string;
    let currentTime = dayjs().set('s', 0).set('ms', 0);
    let currentStopId = null;

    async function fetchLineTimeline(time?: Dayjs) {
        try {
            loading = true;
            currentTime = time;
            lineData = await transitService.getLineTimeline(line.id, time?.utc(true).valueOf());
            DEV_LOG && console.log('lineData', JSON.stringify(line.id, lineData));
            // prevTime = lineData[lineDataIndex].prevTime;
            // nextTime = lineData[lineDataIndex].nextTime;
            timelineItems = lineData[lineDataIndex].arrets;
            if (timelineItems.length === 0) {
                showSnack({ message: lc('no_timesheet_data') });
                return;
            }
            // console.log('fetchLineTimeline', time.valueOf(), lineData[lineDataIndex].prevTime, lineData[lineDataIndex].nextTime);
            directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
            if (line.stopIds) {
                currentStopId = line.stopIds[lineDataIndex];
                const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
                if (index === -1) {
                    line.stopIds = line.stopIds.reverse();
                    currentStopId = line.stopIds[lineDataIndex];
                }
                const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
                collectionView.nativeView.scrollToIndex(scrollIndex, false);
            }
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !timelineItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }

    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            fetchLineTimeline();
        }
    });
    function reverseTimesheet() {
        lineDataIndex = 1 - lineDataIndex;
        timelineItems = lineData[lineDataIndex].arrets;
        directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
        if (line.stopIds) {
            currentStopId = line.stopIds[lineDataIndex];
            const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
            if (index === -1) {
                line.stopIds = line.stopIds.reverse();
                currentStopId = line.stopIds[lineDataIndex];
            }
            const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
            collectionView.nativeView.scrollToIndex(scrollIndex, false);
        }
    }

    function getTripTime(item, index) {
        const data = item.trips[index];
        if (typeof data === 'string') {
            return data;
        }
        if (index !== undefined) {
            return dayjs().startOf('d').add(data, 's').format('LT');
        }
        return '|';
    }

    async function selectDate() {
        try {
            const dayStart = currentTime.startOf('d');
            const date = await pickDate(currentTime);
            if (date && dayStart.valueOf() !== date) {
                fetchLineTimeline(dayjs(date).set('h', currentTime.get('h')).set('m', currentTime.get('m')));
            }
        } catch (error) {
            showError(error);
        }
    }
    async function selectTime() {
        try {
            const currentMinute = currentTime.get('h');
            const currentHour = currentTime.get('m');
            const [minute, hour] = await pickTime(currentTime);

            if (currentMinute !== minute && currentHour !== hour) {
                fetchLineTimeline(currentTime.set('h', hour).set('m', minute));
            }
        } catch (error) {
            showError(error);
        }
    }
    async function previousDates() {
        if (lineData[lineDataIndex].prevTime) {
            fetchLineTimeline(dayjs.utc(lineData[lineDataIndex].prevTime));
        }
    }
    async function nextDates() {
        if (lineData[lineDataIndex].nextTime) {
            fetchLineTimeline(dayjs.utc(lineData[lineDataIndex].nextTime));
        }
    }

    async function downloadPDF() {
        try {
            openUrl(`https://data.mobilites-m.fr/api/ficheHoraires/pdf?route=${line.id}`);
        } catch (error) {
            showError(error);
        }
    }

    async function showDetails() {
        try {
            const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
            await navigate({
                page: component as any,
                props: {
                    line
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    onMount(() => {
        fetchLineTimeline(currentTime);
    });

    onThemeChanged(() => collectionView?.nativeView.refreshVisibleItems());
</script>

<page bind:this={page} actionBarHidden={true}>
    <gridlayout rows="auto,auto,auto,*" columns="auto,*,auto">
        <CActionBar backgroundColor="transparent" colSpan={3}>
            <label slot="center" class="transitIconLabel" colSpan={3} marginLeft={5} backgroundColor={line.color} color={line.textColor} text={line.shortName} autoFontSize={true} />
            <IconButton text="mdi-file-pdf-box" on:tap={downloadPDF} />
            <IconButton text="mdi-information-outline" on:tap={showDetails} />
        </CActionBar>

        <label
            row={1}
            colSpan={3}
            text={line.longName.replace(' / ', '\n')}
            fontWeight="bold"
            padding="15 10 15 10"
            fontSize={20}
            maxFontSize={20}
            autoFontSize={true}
            maxLines={3}
            textAlignment="center"
            verticalTextAlignment="center"
        />
        <gridlayout row={2} colSpan={3} columns="*,40,*" rows="50,auto" visibility={noNetworkAndNoData ? 'hidden' : 'visible'}>
            <canvaslabel borderBottomColor={$borderColor} borderBottomWidth={1} marginLeft={20} rippleColor={accentColor} on:tap={() => selectDate()}>
                <cspan text={lc('date')} fontSize={11} color={$subtitleColor} verticalAlignment="top" />
                <cspan text="mdi-calendar-today" fontSize={22} fontFamily={mdiFontFamily} verticalAlignment="middle" textAlignment="right" />
                <cspan text={currentTime.format('L')} fontSize={14} verticalAlignment="middle" />
            </canvaslabel>
            <canvaslabel col={2} borderBottomColor={$borderColor} borderBottomWidth={1} marginRight={20} rippleColor={accentColor} on:tap={() => selectTime()}>
                <cspan text={lc('time')} fontSize={11} color={$subtitleColor} verticalAlignment="top" />
                <cspan text="mdi-calendar-clock" fontSize={22} fontFamily={mdiFontFamily} verticalAlignment="middle" textAlignment="right" />
                <cspan text={currentTime.format('LT')} fontSize={14} verticalAlignment="middle" />
            </canvaslabel>
            <stacklayout orientation="horizontal" horizontalAlignment="center" row={1} rippleColor={accentColor} on:tap={reverseTimesheet} colSpan={3} margin={20}>
                <label fontFamily={mdiFontFamily} fontSize={22} text="mdi-swap-vertical" verticalTextAlignment="center" />
                <label fontSize={14} text={directionText} />
            </stacklayout>
            <IconButton row={1} colSpan={3} text="mdi-chevron-left" horizontalAlignment="left" on:tap={previousDates} />
            <IconButton row={1} colSpan={3} text="mdi-chevron-right" horizontalAlignment="right" on:tap={nextDates} />
        </gridlayout>

        <collectionview row={3} colSpan={3} bind:this={collectionView} items={timelineItems} itemIdGenerator={(item, i) => i} android:marginBottom={$navigationBarHeight} rowHeight={50}>
            <Template let:item>
                <gridlayout rippleColor={item.color} columns="*,200" padding={4} borderBottomColor={$borderColor} borderBottomWidth={1}>
                    <label
                        text={item.stopName}
                        maxFontSize={13}
                        fontSize={13}
                        autoFontSize={true}
                        verticalTextAlignment="center"
                        color={item.stopId === currentStopId ? accentColor : $textColor}
                        maxLines={2}
                        paddingRight={10}
                    />
                    <canvaslabel col={1} fontSize={12} color={item.stopId === currentStopId ? accentColor : $textColor} textAlignment="center">
                        <cspan text={getTripTime(item, 0)} verticalAlignment="middle" width="25%" />
                        <cspan text={getTripTime(item, 1)} verticalAlignment="middle" paddingLeft="25%" width="25%" />
                        <cspan text={getTripTime(item, 2)} verticalAlignment="middle" paddingLeft="50%" width="25%" />
                        <cspan text={getTripTime(item, 3)} verticalAlignment="middle" paddingLeft="75%" width="25%" />
                    </canvaslabel>
                </gridlayout>
            </Template>
        </collectionview>
        <mdactivityindicator row={3} colSpan={3} visibility={loading ? 'visible' : 'collapsed'} busy={true} horizontalAlignment="center" verticalAlignment="middle" />
        {#if noNetworkAndNoData}
            <canvaslabel row={2} rowSpan={2} colSpan={3}>
                <cgroup textAlignment="center" verticalAlignment="middle">
                    <cspan text="mdi-alert-circle-outline" fontSize={50} fontFamily={mdiFontFamily} />
                    <cspan text={'\n' + lc('no_network')} fontSize={20} />
                </cgroup>
            </canvaslabel>
        {/if}
    </gridlayout>
</page>
