<script lang="ts" context="module">
    import type { MapPos } from '@nativescript-community/ui-carto/core';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { convertDuration, osmicon, convertElevation, convertValueToUnit, UNITS } from '~/helpers/formatter';
    import type { IItem as Item } from '~/models/Item';
    import type { RouteInstruction } from '~/models/Route';
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
    let showSymbol: boolean = false;
    let itemIsRoute = false;
    let itemProps = null;
    // $: itemRouteNoProfile = item && !!item.route && (!item.route.profile || !item.route.profile.max);

    let remainingDistanceOnCurrentRoute = null;
    let routeInstruction: RouteInstruction = null;
    let currentLocation: MapPos<LatLonKeys> = null;

    function propValue(prop) {
        switch (prop) {
            case 'ele':
                return convertElevation(item.properties[prop]);
            case 'dplus':
                return routeDplus;
            case 'dmin':
                return routeDmin;
            case 'distance':
                return routeDistance;
        }
        return item.properties[prop];
    }
    function propIcon(prop) {
        // console.log('propIcon', prop);
        switch (prop) {
            case 'ele':
            case 'dplus':
                return 'mdi-elevation-rise';
            case 'dmin':
                return 'mdi-elevation-decline';
            case 'distance':
                return 'mdi-map-marker-distance';
        }
        return null;
    }

    export function onNewLocation(e: any) {
        currentLocation = e.data;
        return updateRouteItemWithPosition(item, currentLocation);
    }

    function updateRouteItemWithPosition(routeItem: Item, location) {
        if (routeItem) {
            const route = routeItem.route;
            const positions = route.positions;
            const onPathIndex = isLocationOnPath(location, positions, false, true, 10);
            if (onPathIndex >= 0) {
                const distance = distanceToEnd(onPathIndex, positions);
                remainingDistanceOnCurrentRoute = distance;
                routeInstruction = null;
                for (let index = route.instructions.length - 1; index >= 0; index--) {
                    const element = route.instructions[index];
                    if (element.index <= onPathIndex) {
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

    function updateItem(item) {
        itemIsRoute = item && !!item.route;
        itemProps = item && item.properties;
        itemIcon = item && formatter.geItemIcon(item);
        itemTitle = item && formatter.getItemTitle(item);
        itemSubtitle = item && formatter.getItemSubtitle(item);
        showSymbol = itemIsRoute && itemProps && !!itemProps.ref;
        let newPropsToDraw = [];
        if (!itemIsRoute && item) {
            const props = item.properties;
            if (props) {
                newPropsToDraw = PROPS_TO_SHOW.filter((k) => props.hasOwnProperty(k));
            } else {
                newPropsToDraw = [];
            }
        } else {
            newPropsToDraw = [];
        }

        if (!item || !itemIsRoute) {
            routeDistance = null;
            routeDuration = null;
        } else {
            const route = item.route;
            let result;
            if (route.totalDistance || (itemProps && itemProps.distance)) {
                result = `${convertValueToUnit(route.totalDistance || itemProps.distance * 1000, UNITS.DistanceKm).join(' ')}`;
                if (remainingDistanceOnCurrentRoute) {
                    result += ` (${convertValueToUnit(remainingDistanceOnCurrentRoute, UNITS.DistanceKm).join(' ')})`;
                }
                routeDistance = result;
                newPropsToDraw.push('distance');
            }

            if (route.totalTime) {
                result = `${convertDuration(route.totalTime * 1000)}`;
                if (remainingDistanceOnCurrentRoute) {
                    result += ` (~ ${convertDuration(
                        ((route.totalTime * remainingDistanceOnCurrentRoute) / route.totalDistance) * 1000
                    )})`;
                }
                routeDuration = result;
            }
        }

        hasProfile = itemIsRoute && !!item.route.profile && !!item.route.profile.max;
        if (!hasProfile) {
            if (itemProps && itemProps.ascent) {
                routeDplus = `${convertElevation(itemProps.ascent)}`;
                newPropsToDraw.push('dplus');
            } else {
                routeDplus = null;
            }
            if (itemProps && itemProps.descent) {
                routeDmin = `${convertElevation(itemProps.descent)}`;
                newPropsToDraw.push('dmin');
            } else {
                routeDmin = null;
            }
        } else {
            const profile = item.route.profile;
            routeDplus = `${convertElevation(profile.dplus)}`;
            routeDmin = `${convertElevation(-profile.dmin)}`;
            newPropsToDraw.push('dplus', 'dmin');
        }
        propsToDraw = newPropsToDraw;
    }
    $: {
        try {
            updateItem(item);
        } catch (err) {
            console.error('updateItem', err);
        }
    }
    $: {
        if (itemIsRoute && currentLocation) {
            updateRouteItemWithPosition(item, currentLocation);
        }
    }
</script>

<canvaslabel {...$$restProps} fontSize="16" color="white" padding="10 10 4 10">
    <cspan horizontalAlignment="left" verticalAlignment="top" text={routeInstruction && routeInstruction.inst} fontSize={15} />
    <cgroup verticalAlignment="middle" paddingBottom={(itemSubtitle ? 4 : 0) + (propsToDraw.length > 0 ? 12 : 0)}>
        <cspan
            visibility={itemIcon ? 'visible' : 'hidden'}
            paddingLeft="10"
            width="40"
            text={osmicon(itemIcon)}
            fontFamily="osm"
            fontSize={24}
        />
    </cgroup>
    <symbolshape
        visibility={showSymbol ? 'visible' : 'hidden'}
        symbol={(itemProps && itemProps.symbol) || 0}
        color={(itemProps && itemProps.color) || 0}
        width="34"
        height="32"
        top={propsToDraw.length > 0 ? 1 : 6}
    />

    <cgroup
        paddingLeft="40"
        paddingBottom={(itemSubtitle ? 4 : 0) + (propsToDraw.length > 0 ? 12 : 0)}
        verticalAlignment="middle"
        textAlignment="left">
        <cspan
            text={itemTitle}
            fontWeight="bold"
            color={routeDuration ? '#01B719' : 'white'}
            :fontSize={routeInstruction ? 10 : 16}
            :paddingTop={routeInstruction ? 18 : 0}
        />
        <cspan text={itemSubtitle ? '\n' + itemSubtitle : ''} color="#D0D0D0" fontSize={13} />
    </cgroup>
    <cgroup
        fontSize="14"
        verticalAlignment="bottom"
        textAlignment="left"
        visibility={propsToDraw.length > 0 ? 'visible' : 'hidden'}>
        {#each propsToDraw as prop, index}
            <cgroup>
                <cspan fontFamily={mdiFontFamily} color="gray" text={propIcon(prop) + ' '} />
                <cspan text={propValue(prop) + '  '} />
            </cgroup>
        {/each}
    </cgroup>
</canvaslabel>
