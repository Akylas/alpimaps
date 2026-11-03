<script lang="ts">
    import type { MapPos } from '~/utils/geo';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { closeBottomSheet } from '@nativescript-community/ui-bottomsheet/svelte';
    import { onMount } from 'svelte';
    import { Template } from '@nativescript-community/svelte-native/components';
    import { NativeViewElementNode } from '@nativescript-community/svelte-native/dom';
    import { lc } from '~/helpers/locale';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { type StopLine, getStopLines } from '~/features/trains/lines';
    import { NoNetworkError } from '@akylas/nativescript-app-utils/error';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import { fonts, windowInset } from '~/variables';
    import IconButton from '~/components/common/IconButton.svelte';
    import PanelHeader from '~/components/common/PanelHeader.svelte';

    export let position: MapPos;
    export let name: string;

    $: ({ bottom: windowInsetBottom } = $windowInset);
    let loading = false;
    let collectionView: NativeViewElementNode<CollectionView>;
    let linesItems: StopLine[] = null;
    let noNetworkAndNoData = false;

    async function refresh() {
        try {
            loading = true;
            linesItems = await getStopLines(position);
            noNetworkAndNoData = false;
        } catch (error) {
            if (error instanceof NoNetworkError && !linesItems) {
                noNetworkAndNoData = true;
            }
            showError(error);
        } finally {
            loading = false;
        }
    }
    onNetworkChanged((connected) => {
        if (connected && noNetworkAndNoData) {
            refresh();
        }
    });
    async function showTimesheet(item: StopLine) {
        try {
            closeBottomSheet();
            const component = (await import('~/features/trains/LineTimesheet.svelte')).default;
            navigate({
                page: component,
                props: {
                    line: item
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    async function showDetails(item: StopLine) {
        try {
            closeBottomSheet();
            const component = (await import('~/features/trains/LineDetails.svelte')).default;
            navigate({
                page: component,
                props: {
                    line: item,
                    position
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    onMount(() => {
        refresh();
    });
</script>

<gesturerootview class="bottomsheet" height={300} rows="auto,*">
    <PanelHeader icon="mdi-bus" title={name} />
    <collectionview bind:this={collectionView} id="scrollView" itemIdGenerator={(item, i) => i} items={linesItems} row={1} android:marginBottom={windowInsetBottom} rowHeight={70}>
        <Template let:item>
            <gridlayout columns="auto,*,auto,auto" padding={10} rippleColor={item.color} on:tap={() => showTimesheet(item)}>
                <label class="transitIconLabel" autoFontSize={true} backgroundColor={item.color} borderRadius={4} color={item.textColor} maxFontSize={30} text={item.shortName || item.longName} />
                <label
                    autoFontSize={true}
                    col={1}
                    fontSize={17}
                    lineBreak="end"
                    maxFontSize={17}
                    maxLines={3}
                    paddingLeft={10}
                    text={item.longName || item.directions.map((direction) => direction.headsign).join(' / ')}
                    verticalTextAlignment="center" />
                <IconButton col={2} text="mdi-routes" on:tap={() => showDetails(item)} />
                <IconButton col={3} text="mdi-routes-clock" on:tap={() => showTimesheet(item)} />
            </gridlayout>
        </Template>
    </collectionview>
    {#if noNetworkAndNoData}
        <canvaslabel row={1}>
            <cgroup textAlignment="center" verticalAlignment="middle">
                <cspan fontFamily={$fonts.mdi} fontSize={50} text="mdi-alert-circle-outline" />
                <cspan fontSize={20} text={'\n' + lc('no_network')} />
            </cgroup>
        </canvaslabel>
    {/if}
    <activityindicator busy={true} horizontalAlignment="right" verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
</gesturerootview>
