<script lang="ts">
    import type { GenericMapPos, MapPos } from '@nativescript-community/ui-carto/core';
    import { distanceToEnd, isLocationOnPath } from '@nativescript-community/ui-carto/utils';
    import { convertDuration, osmicon, convertElevation, convertValueToUnit, UNITS } from '~/helpers/formatter';
    import type { IItem as Item } from '~/models/Item';
    import type { RouteInstruction } from '~/models/Route';
    import { mdiFontFamily, subtitleColor, textColor } from '~/variables';
    import { formatter } from '~/mapModules/ItemFormatter';
    import dayjs from 'dayjs';
    const PROPS_TO_SHOW = ['ele'];

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
            case 'duration':
                return routeDuration;
        }
        return item.properties[prop];
    }
    function propIcon(prop) {
        // console.log('propIcon', prop);
        switch (prop) {
            case 'ele':
            case 'dplus':
                return '↑';
            case 'dmin':
                return '↓';
            case 'distance':
                return 'mdi-map-marker-distance';
            case 'duration':
                return 'mdi-timer';
        }
        return null;
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
                newPropsToDraw = PROPS_TO_SHOW.filter((k) => k in props);
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
                routeDistance = result;
                newPropsToDraw.push('distance');
            }

            if (route.totalTime) {
                if (route.totalTime < 3600) {
                    routeDuration = dayjs.duration( route.totalTime, 'seconds').format('m [min]');
                } else {
                    routeDuration = dayjs.duration( route.totalTime, 'seconds').format('H [h] m [min]');

                }
                newPropsToDraw.push('duration');
            }
        }

        hasProfile = itemIsRoute && !!item.route.profile && !!item.route.profile.max;
        if (!hasProfile) {
            if (itemProps && itemProps.ascent && itemProps.ascent > 0) {
                routeDplus = `${convertElevation(itemProps.ascent)}`;
                newPropsToDraw.push('dplus');
            } else {
                routeDplus = null;
            }
            if (itemProps && itemProps.descent && itemProps.descent > 0) {
                routeDmin = `${convertElevation(itemProps.descent)}`;
                newPropsToDraw.push('dmin');
            } else {
                routeDmin = null;
            }
        } else {
            const profile = item.route.profile;
            if (profile.dplus > 0) {
                routeDplus = `${convertElevation(profile.dplus)}`;
                newPropsToDraw.push('dplus');
            }
            if (profile.dmin < 0) {
                routeDmin = `${convertElevation(-profile.dmin)}`;
                newPropsToDraw.push('dmin');
            }
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
</script>

<canvaslabel {...$$restProps} fontSize="16" padding="10 10 4 10">
    <cgroup verticalAlignment="middle" paddingBottom={(itemSubtitle ? 4 : 0) + (propsToDraw.length > 0 ? 12 : 0)}>
        <cspan
            visibility={itemIcon && itemIcon.length > 0 ? 'visible' : 'hidden'}
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
        textAlignment="left"
    >
        <cspan text={itemTitle} fontWeight="bold" color={routeDuration ? '#01B719' : $textColor} :fontSize={16} />
        <cspan text={itemSubtitle ? '\n' + itemSubtitle : ''} color={$subtitleColor} fontSize={13} maxLines={2} />
    </cgroup>
    <cgroup
        fontSize="14"
        verticalAlignment="bottom"
        textAlignment="left"
        visibility={propsToDraw.length > 0 ? 'visible' : 'hidden'}
    >
        {#each propsToDraw as prop, index}
            <cgroup>
                <cspan fontFamily={mdiFontFamily} color="gray" text={propIcon(prop) + ' '} />
                <cspan text={propValue(prop) + '  '} />
            </cgroup>
        {/each}
    </cgroup>
</canvaslabel>
