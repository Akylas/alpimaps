<script lang="ts">
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { CollectionView } from '@nativescript-community/ui-collectionview';
    import { closeBottomSheet } from '@nativescript-community/ui-material-bottomsheet/svelte';
    import { onMount } from 'svelte';
    import { Template } from 'svelte-native/components';
    import { NativeViewElementNode } from 'svelte-native/dom';
    import { lc } from '~/helpers/locale';
    import { onNetworkChanged } from '~/services/NetworkService';
    import { TransitRoute, transitService } from '~/services/TransitService';
    import { NoNetworkError } from '@shared/utils/error';
    import { showError } from '@shared/utils/showError';
    import { navigate } from '@shared/utils/svelte/ui';
    import { fonts, windowInset } from '~/variables';
    import IconButton from '../common/IconButton.svelte';

    export let position: MapPos<LatLonKeys>;
    export let name: string;

    $: ({ bottom: windowInsetBottom } = $windowInset);
    let loading = false;
    let collectionView: NativeViewElementNode<CollectionView>;
    let linesItems: TransitRoute[] = null;
    let noNetworkAndNoData = false;

    async function refresh() {
        try {
            loading = true;
            // const lines = await transitService.getMetroLinesData();
            // const linesData = positionData.reduce((acc, d) => {
            //     d.lines.forEach((l) => {
            //         if (!acc[l]) {
            //             acc[l] = { ...lines[l], stopIds: [d.id], position: { lat: d.lat, lon: d.lon }, id: l };
            //         } else {
            //             acc[l].stopIds.push(d.id);
            //         }
            //     });
            //     return acc;
            // }, {});
            // linesItems = Object.values(linesData);
            linesItems = (await transitService.routes({ position })).sort((a, b) => {
                const aS = a.id;
                const bS = b.id;
                if (aS.length === bS.length) {
                    return aS > bS ? 1 : -1;
                }
                return aS.length - bS.length;
            });
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
    async function showTimesheet(item: TransitRoute) {
        try {
            closeBottomSheet();
            const component = (await import('~/components/transit/TransitTimesheet.svelte')).default;
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

    async function showDetails(item: TransitRoute) {
        try {
            closeBottomSheet();
            const component = (await import('~/components/transit/TransitLineDetails.svelte')).default;
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

    async function getTimes(item: TransitRoute) {
        try {
            DEV_LOG && console.log('getTimes', item);
            const times = await transitService.getStopTimes(item.stopIds[0]);
        } catch (error) {
            showError(error);
        }
    }

    onMount(() => {
        refresh();
    });

    function getItemColor(item: TransitRoute) {
        return transitService.getRouteColor(item);
    }
    function getItemTextColor(item: TransitRoute) {
        return transitService.getRouteTextColor(item);
    }
</script>

<gesturerootview class="bottomsheet" height={300} rows="auto,*">
    <label fontSize={20} fontWeight="bold" padding="15 10 15 20" text={name} />
    <collectionview bind:this={collectionView} id="scrollView" itemIdGenerator={(item, i) => i} items={linesItems} row={1} android:marginBottom={windowInsetBottom} rowHeight={70}>
        <Template let:item>
            <gridlayout columns="auto,*,auto,auto" padding={10} rippleColor={getItemColor(item)} on:tap={() => showTimesheet(item)}>
                <label
                    class="transitIconLabel"
                    autoFontSize={true}
                    backgroundColor={getItemColor(item)}
                    borderRadius={4}
                    color={getItemTextColor(item)}
                    maxFontSize={30}
                    text={item.shortName || item.name} />
                <label autoFontSize={true} col={1} fontSize={17} lineBreak="end" maxFontSize={17} maxLines={3} paddingLeft={10} text={item.longName} verticalTextAlignment="center" />
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
    <mdactivityindicator busy={true} horizontalAlignment="right" verticalAlignment="middle" visibility={loading ? 'visible' : 'hidden'} />
</gesturerootview>
