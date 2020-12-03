<script lang="ts" context="module">
    import { MapPos } from '@nativescript-community/ui-carto/core';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { convertDuration, convertElevation, convertValueToUnit } from '~/helpers/formatter';
    import { IItem as Item } from '~/models/Item';
    import { RouteInstruction } from '~/models/Route';
    import { mdiFontFamily } from '~/variables';
</script>

<script lang="ts">
    export let routeItem: Item;
    $: {
        if (currentLocation) {
            updateRouteItemWithPosition(routeItem, currentLocation);
        }
    }

    let remainingDistanceOnCurrentRoute = null;
    let routeInstruction: RouteInstruction = null;
    let currentLocation: MapPos<LatLonKeys> = null;
    export function onNewLocation(e: any) {
        currentLocation = e.data;
        return updateRouteItemWithPosition(routeItem, currentLocation);
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
    let routeDistance = '';
    $: {
        if (!routeItem) {
            routeDistance = null;
        } else {
            const route = routeItem.route;
            let result = `${convertValueToUnit(route.totalDistance, 'km').join(' ')}`;
            if (remainingDistanceOnCurrentRoute) {
                result += ` (${convertValueToUnit(remainingDistanceOnCurrentRoute, 'km').join(' ')})`;
            }
            routeDistance = result;
        }
    }
    let routeDuration: string = null;
    $: {
        if (!routeItem) {
            routeDuration = null;
        } else {
            const route = routeItem.route;
            let result = `${convertDuration(route.totalTime * 1000)}`;
            if (remainingDistanceOnCurrentRoute) {
                result += ` (~ ${convertDuration(
                    ((route.totalTime * remainingDistanceOnCurrentRoute) / route.totalDistance) * 1000
                )})`;
            }
            routeDuration = result;
        }
    }
    let routeDplus: string = null;
    $: {
        if (!hasProfile) {
            routeDplus = null;
        } else {
            const profile = routeItem.route.profile;
            routeDplus = `${convertElevation(profile.dplus)}`;
        }
    }
    let routeDmin: string = null;
    $: {
        if (!hasProfile) {
            routeDmin = null;
        } else {
            const profile = routeItem.route.profile;
            routeDmin = `${convertElevation(-profile.dmin)}`;
        }
    }
    let hasProfile = false;
    $: {
        if (!routeItem) {
            hasProfile = false;
        } else {
            const profile = routeItem.route.profile;
            hasProfile = !!profile && !!profile.max;
        }
    }
</script>

<canvaslabel {...$$restProps} fontSize="16" color="white" padding="10">
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
</canvaslabel>
