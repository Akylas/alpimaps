<script lang="ts">
    import { MapPos } from '@nativescript-community/ui-carto/core';

    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { Page } from '@nativescript/core';
    import { openUrl } from '@nativescript/core/utils';
    import dayjs, { Dayjs } from 'dayjs';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { closeModal, NativeViewElementNode } from 'svelte-native/dom';
    import { lc } from '~/helpers/locale';
    import { transitService } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { openLink } from '~/utils/ui';
    import { accentColor, borderColor, globalMarginTop, mdiFontFamily, navigationBarHeight, subtitleColor, textColor } from '~/variables';

    export let line: any;

    let selectedPageIndex = 0;
    let loading = false;
    let page: NativeViewElementNode<Page>;
    let collectionView: NativeViewElementNode<CollectionView>;
    let linesItems: any[] = null;
    let timelineItems: any[] = null;

    let lineData = null;

    let lineDataIndex = 0;

    let directionText: string;
    async function fetchLineTimeline(time?: Dayjs) {
        try {
            loading = true;
            currentTime = time;
            console.log('fetchLineTimeline', time, time.valueOf(), dayjs().startOf('d'), dayjs().startOf('d').valueOf());
            lineData = await transitService.getLineTimeline(line.id, time?.utc(true).valueOf());
            // prevTime = lineData[lineDataIndex].prevTime;
            // nextTime = lineData[lineDataIndex].nextTime;
            timelineItems = lineData[lineDataIndex].arrets;
            currentStopId = line.stopIds[lineDataIndex];
            directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
            const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
            if (index === -1) {
                line.stopIds = line.stopIds.reverse();
                currentStopId = line.stopIds[lineDataIndex];
            }
            const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
            collectionView.nativeView.scrollToIndex(scrollIndex, false);
        } catch (error) {
            showError(error);
        } finally {
            loading = false;
        }
    }

    function reverseTimesheet() {
        lineDataIndex = 1 - lineDataIndex;
        timelineItems = lineData[lineDataIndex].arrets;
        currentStopId = line.stopIds[lineDataIndex];
        directionText = timelineItems[0].stopName + '\n' + timelineItems[timelineItems.length - 1].stopName;
        const index = timelineItems.findIndex((a) => a.stopId === currentStopId);
        if (index === -1) {
            line.stopIds = line.stopIds.reverse();
            currentStopId = line.stopIds[lineDataIndex];
        }
        const scrollIndex = timelineItems.findIndex((s) => s.stopId === currentStopId);
        collectionView.nativeView.scrollToIndex(scrollIndex, false);
    }

    let currentTime = dayjs();
    let currentStopId = null;

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

    async function pickDate(currentDate: Dayjs) {
        return new Promise<number>((resolve, reject) => {
            const datePicker = com.google.android.material.datepicker.MaterialDatePicker.Builder.datePicker()
                .setTitleText(lc('pick_date'))
                .setSelection(new java.lang.Long(currentDate.valueOf()))
                .build();
            datePicker.addOnDismissListener(
                new android.content.DialogInterface.OnDismissListener({
                    onDismiss: () => {
                        resolve(datePicker.getSelection().longValue());
                    }
                })
            );
            datePicker.show(page.nativeView._getRootFragmentManager(), 'datepicker');
        });
    }

    async function pickTime(currentDate: Dayjs) {
        return new Promise<[number, number]>((resolve, reject) => {
            const timePicker = new (com.google.android.material as any).timepicker.MaterialTimePicker.Builder()
                .setTimeFormat(1)
                .setTitleText(lc('pick_time'))
                .setHour(currentDate.get('h'))
                .setMinute(currentDate.get('m'))
                .build();

            timePicker.addOnDismissListener(
                new android.content.DialogInterface.OnDismissListener({
                    onDismiss: () => {
                        resolve([timePicker.getMinute(), timePicker.getHour()]);
                    }
                })
            );
            timePicker.show(page.nativeView._getRootFragmentManager(), 'timepicker');
        });
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
            console.log('previousDates', lineData[lineDataIndex].prevTime);
            fetchLineTimeline(dayjs.utc(lineData[lineDataIndex].prevTime));
        }
    }
    async function nextDates() {
        if (lineData[lineDataIndex].nextTime) {
            console.log('nextDates', lineData[lineDataIndex].nextTime);
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

    onMount(() => {
        fetchLineTimeline(currentTime);
    });
</script>

<page bind:this={page} actionBarHidden={true}>
    <gridlayout rows="auto,auto,*" columns="auto,*,auto" paddingTop={globalMarginTop}>
        <label
            borderRadius={4}
            marginLeft={5}
            width={50}
            height={50}
            backgroundColor={line.color}
            color={line.textColor}
            text={line.shortName}
            fontSize={20}
            autoFontSize={true}
            textAlignment="center"
            verticalTextAlignment="center"
            padding={8}
        />
        <label col={1} text={line.longName.replace(' / ', '\n')} fontWeight="bold" padding="15 10 15 10" fontSize={20} maxFontSize={20} autoFontSize={true} maxLines={3} />
        <stacklayout col={2} orientation="horizontal">
            <button variant="text" class="icon-btn" text="mdi-close" on:tap={() => closeModal(undefined)} />
            <button variant="text" class="icon-btn" text="mdi-pdf-box" on:tap={() => downloadPDF()} />
        </stacklayout>
        <gridlayout row={1} colSpan={3} columns="*,40,*" rows="50,auto">
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
            <button row={1} colSpan={3} variant="text" class="icon-btn" text="mdi-chevron-left" horizontalAlignment="left" on:tap={() => previousDates()} />
            <button row={1} colSpan={3} variant="text" class="icon-btn" text="mdi-chevron-right" horizontalAlignment="right" on:tap={() => nextDates()} />
        </gridlayout>

        <collectionview row={2} colSpan={3} bind:this={collectionView} items={timelineItems} itemIdGenerator={(item, i) => i} android:marginBottom={navigationBarHeight} rowHeight="50">
            <Template let:item>
                <gridlayout rippleColor={item.color} columns="*,150" padding={4} borderBottomColor={$borderColor} borderBottomWidth={1}>
                    <label
                        text={item.stopName}
                        maxFontSize={13}
                        fontSize={13}
                        autoFontSize={true}
                        verticalTextAlignment="center"
                        color={item.stopId === currentStopId ? accentColor : $textColor}
                        maxLines={2}
                    />
                    <canvaslabel col="1" fontSize={12} color={item.stopId === currentStopId ? accentColor : $textColor}>
                        <cspan text={getTripTime(item, 0)} textAlignment="center" verticalAlignment="center" width="30%" />
                        <cspan text={getTripTime(item, 1)} horizontalAlignment="center" textAlignment="center" verticalAlignment="center" width="30%" />
                        <cspan text={getTripTime(item, 2)} horizontalAlignment="right" textAlignment="center" verticalAlignment="center" width="30%" />
                    </canvaslabel>
                </gridlayout>
            </Template>
        </collectionview>
        <mdactivityindicator row={2} colSpan={3} visibility={loading ? 'visible' : 'collapsed'} busy={true} horizontalAlignment="center" verticalAlignment="center" />
    </gridlayout>
</page>
