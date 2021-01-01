<script lang="ts" context="module">
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { convertDuration, osmicon, convertElevation, convertValueToUnit } from '~/helpers/formatter';
    import { IItem as Item } from '~/models/Item';
    import { RouteInstruction } from '~/models/Route';
    import { mdiFontFamily } from '~/variables';
    import { formatter } from '~/mapModules/ItemFormatter';
    const PROPS_TO_SHOW = ['ele'];
</script>

<script lang="ts">
    export let item: Item;
    let itemIcon: string[] = null;
    let itemTitle: string = null;
    let itemSubtitle: string = null;
    let propsToDraw = [];
    let routeDistance = '';
    let routeDuration: string = null;
    let routeDplus: string = null;
    let hasProfile = false;
    let routeDmin: string = null;
    let itemIsRoute = false;
    // $: itemRouteNoProfile = item && !!item.route && (!item.route.profile || !item.route.profile.max);

    let remainingDistanceOnCurrentRoute = null;
    let routeInstruction: RouteInstruction = null;
    let currentLocation: MapPos<LatLonKeys> = null;

    function propValue(prop) {
        switch (prop) {
            case 'ele':
                return convertElevation(item.properties[prop]);
        }
        return item.properties[prop];
    }
    function propIcon(prop) {
        // console.log('propIcon', prop);
        switch (prop) {
            case 'ele':
                return 'mdi-elevation-rise';
        }
        return null;
    }

    export function onNewLocation(e: any) {
        currentLocation = e.data;
        return updateRouteItemWithPosition(item, currentLocation);
    }

    function updateRouteItemWithPosition(routeItem, location) {
        if (routeItem) {
            const route = routeItem.route;
            const positions = route.positions;
            const onPathIndex = isLocationOnPath(location, positions, false, true, 10);
            console.log('onPathIndex', onPathIndex);
            if (onPathIndex >= 0) {
                const distance = distanceToEnd(onPathIndex, positions);
                remainingDistanceOnCurrentRoute = distance;
                routeInstruction = null;
                for (let index = route.instructions.length - 1; index >= 0; index--) {
                    const element = route.instructions[index];
                    if (element.pointIndex <= onPathIndex) {
                        routeInstruction = element;
                        break;
                    }
                }
                console.log('instruction', routeInstruction);
            } else {
                routeInstruction = null;
                remainingDistanceOnCurrentRoute = null;
            }
            return onPathIndex;
        } else {
            remainingDistanceOnCurrentRoute = null;
            routeInstruction = null;
        }
        return -1;
    }
    $:{
        if (itemIsRoute && currentLocation) {
            updateRouteItemWithPosition(item, currentLocation);
        }
    }
    $: {
        itemIsRoute = item && !!item.route;
        itemIcon = item && formatter.geItemIcon(item);
        itemTitle = item && formatter.getItemTitle(item);
        itemSubtitle = item && formatter.getItemSubtitle(item);
        
        if (!itemIsRoute && item) {
            const props = item.properties;
            if (props) {
                propsToDraw = PROPS_TO_SHOW.filter((k) => props.hasOwnProperty(k));
            } else {
                propsToDraw = [];
            }
        } else {
            propsToDraw = [];
        }

        if (!item || !itemIsRoute) {
            routeDistance = null;
            routeDuration = null;
        } else {
            const route = item.route;
            let result = `${convertValueToUnit(route.totalDistance, 'km').join(' ')}`;
            if (remainingDistanceOnCurrentRoute) {
                result += ` (${convertValueToUnit(remainingDistanceOnCurrentRoute, 'km').join(' ')})`;
            }
            routeDistance = result;
             result = `${convertDuration(route.totalTime * 1000)}`;
            if (remainingDistanceOnCurrentRoute) {
                result += ` (~ ${convertDuration(
                    ((route.totalTime * remainingDistanceOnCurrentRoute) / route.totalDistance) * 1000
                )})`;
            }
            routeDuration = result;
        }
 
        hasProfile = itemIsRoute && !!item.route.profile && !!item.route.profile.max;
        if (!hasProfile) {
            routeDplus = null;
            routeDmin = null;
        } else {
            const profile = item.route.profile;
            routeDplus = `${convertElevation(profile.dplus)}`;
            routeDmin = `${convertElevation(-profile.dmin)}`;
        }
    }
</script>

<canvaslabel {...$$restProps} fontSize="16" color="white" padding="10">
    {#if itemIsRoute}
        <cspan
            horizontalAlignment="left"
            verticalAlignment="top"
            text={routeInstruction && routeInstruction.inst}
            fontSize={15} />
        <cspan
            horizontalAlignment="left"
            verticalAlignment="top"
            color="#01B719"
            fontWeight="bold"
            text={routeDuration}
            :fontSize={routeInstruction ? 10 : 16}
            :paddingTop={routeInstruction ? 18 : 0} />
        <cgroup verticalAlignment="bottom" textAlignment="left">
            <cspan color="gray" fontFamily={mdiFontFamily} text="mdi-map-marker-distance" />
            <cspan text={' ' + routeDistance} fontSize={14} />
        </cgroup>
        <cgroup verticalAlignment="bottom" textAlignment="center" visibility={hasProfile ? 'visible' : 'hidden'}>
            <cspan color="gray" fontFamily={mdiFontFamily} text="mdi-elevation-rise" />
            <cspan text={' ' + routeDplus} fontSize={14} />
        </cgroup>
        <cgroup verticalAlignment="bottom" textAlignment="right" visibility={hasProfile ? 'visible' : 'hidden'}>
            <cspan color="gray" fontFamily={mdiFontFamily} text="mdi-elevation-decline" />
            <cspan text={routeDmin} fontSize={14} />
        </cgroup>
    {:else}
        <cgroup verticalAlignment="middle" paddingBottom={(itemSubtitle ? 10 : 0) + (propsToDraw.length > 0 ? 5 : 0)}>
            <cspan
                visibility={itemIcon ? 'visible' : 'hidden'}
                paddingLeft="10"
                width="40"
                text={osmicon(itemIcon)}
                fontFamily="osm"
                fontSize={24} />
        </cgroup>
        <cgroup paddingLeft="40" paddingBottom={(itemSubtitle ? 10 : 0) + 5} verticalAlignment="middle" textAlignment="left">
            <cspan text={itemTitle} fontWeight="bold" />
            <cspan text={itemSubtitle ? '\n' + itemSubtitle : ''} color="#D0D0D0" fontSize={13} />
        </cgroup>
        {#each propsToDraw as prop, index}
            <cgroup fontSize="14" paddingLeft={index * 60} verticalAlignment="bottom" textAlignment="left">
                <cspan fontFamily={mdiFontFamily} color="gray" text={propIcon(prop) + ' '} />
                <cspan text={propValue(prop)} />
            </cgroup>
        {/each}
    {/if}
</canvaslabel>
