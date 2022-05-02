<script lang="ts">
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode, navigate } from 'svelte-native/dom';
    import { lc } from '~/helpers/locale';
    import { NoNetworkError, onNetworkChanged } from '~/services/NetworkService';
    import { transitService } from '~/services/TransitService';
    import { showError } from '~/utils/error';
    import { mdiFontFamily, navigationBarHeight } from '~/variables';
    import { closeBottomSheet } from '~/utils/bottomsheet';

    export let position: MapPos<LatLonKeys>;
    export let name: string;

    let loading = false;
    let collectionView: NativeViewElementNode<CollectionView>;
    let linesItems: any[] = null;
    let noNetworkAndNoData = false;

    async function refresh() {
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
    async function showTimesheet(item) {
        try {
            closeBottomSheet();
            const component = (await import('~/components/transit/TransitTimesheet.svelte')).default;
            await navigate({
                page: component,
                props: {
                    line: item
                }
            });
        } catch (error) {
            showError(error);
        }
    }

    async function showDetails(item) {
        try {
            closeBottomSheet();
            const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
            await navigate({
                page: component,
                props: {
                    line: item
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

<gridlayout rows="auto,*" class="bottomsheet" height="300">
    <label text={name} fontWeight="bold" padding="15 10 15 20" fontSize="20" />
    <collectionview bind:this={collectionView} id="scrollView" row={1} items={linesItems} itemIdGenerator={(item, i) => i} android:marginBottom={$navigationBarHeight} rowHeight="70">
        <Template let:item>
            <gridlayout rippleColor={item.color} columns="auto,*,auto" padding={10} on:tap={() => showTimesheet(item)}>
                <label borderRadius={4} class="transitIconLabel" backgroundColor={item.color || 'black'} color={item.textColor} text={item.shortName} maxFontSize={30} autoFontSize={true} />
                <label text={item.longName} col={1} fontSize={17} maxFontSize={17} paddingLeft={10} verticalTextAlignment="center" maxLines={2} autoFontSize={true} lineBreak="end" />
                <button col={2} variant="text" class="icon-btn" text="mdi-information-outline" on:tap={() => showDetails(item)} />
            </gridlayout>
        </Template>
    </collectionview>
    {#if noNetworkAndNoData}
        <canvaslabel row={1}>
            <cgroup textAlignment="center" verticalAlignment="center">
                <cspan text="mdi-alert-circle-outline" fontSize={50} fontFamily={mdiFontFamily} />
                <cspan text={'\n' + lc('no_network')} fontSize={20} />
            </cgroup>
        </canvaslabel>
    {/if}
    <mdactivityindicator visibility={loading ? 'visible' : 'collapsed'} busy={true} horizontalAlignment="right" verticalAlignment="center" />
</gridlayout>
