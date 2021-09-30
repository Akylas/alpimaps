<script lang="ts">
    import dayjs from 'dayjs';
    import { convertElevation, convertValueToUnit, osmicon, UNITS } from '~/helpers/formatter';
    import { formatter } from '~/mapModules/ItemFormatter';
    import type { IItem as Item, ItemProperties } from '~/models/Item';
    import { mdiFontFamily, subtitleColor, textColor } from '~/variables';
    import ErrorBoundary from './ErrorBoundary';
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
    let itemProps: ItemProperties = null;
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

    function updateItem(item: Item) {
        if (!item) {
            routeDistance = null;
            routeDuration = null;
            routeDplus = null;
            routeDmin = null;
            propsToDraw = [];
            return;
        }
        itemProps = item?.properties;
        itemIsRoute = !!itemProps?.route;
        itemIcon = formatter.geItemIcon(item);
        itemTitle = formatter.getItemTitle(item);
        itemSubtitle = formatter.getItemSubtitle(item);
        showSymbol = itemIsRoute && itemProps && itemProps.layer === 'route';
        let newPropsToDraw = [];
        if (!itemIsRoute) {
            if (itemProps) {
                newPropsToDraw = PROPS_TO_SHOW.filter((k) => k in itemProps);
            } else {
                newPropsToDraw = [];
            }
        }

        if (!itemIsRoute) {
            routeDistance = null;
            routeDuration = null;
        } else {
            const route = itemProps.route;
            let result;
            if (route.totalDistance || (itemProps && itemProps.distance)) {
                result = `${convertValueToUnit(route.totalDistance || itemProps.distance * 1000, UNITS.DistanceKm).join(' ')}`;
                routeDistance = result;
                newPropsToDraw.push('distance');
            }

            if (route.totalTime) {
                if (route.totalTime < 3600) {
                    routeDuration = dayjs.duration(route.totalTime, 'seconds').format('m [min]');
                } else {
                    routeDuration = dayjs.duration(route.totalTime, 'seconds').format('H [h] m [min]');
                }
                newPropsToDraw.push('duration');
            }
        }

        hasProfile = item && !!itemProps.profile && !!itemProps.profile.max;
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
            const profile = itemProps.profile;
            if (profile.dplus > 0) {
                routeDplus = `${convertElevation(profile.dplus)}`;
                newPropsToDraw.push('dplus');
            }
            if (profile.dmin < 0) {
                routeDmin = `${convertElevation(-profile.dmin)}`;
                newPropsToDraw.push('dmin');
            }
        }
        setTimeout(()=>{
            propsToDraw = newPropsToDraw;
        }, 100);
    }
    $: {
        try {
            updateItem(item);
        } catch (err) {
            console.error('updateItem', err);
        }
    }
</script>

<gridlayout {...$$restProps} padding="5 10 4 10">
    <flexlayout paddingLeft="40" marginBottom={propsToDraw.length > 0 ? 16 : 0} flexDirection="column">
        <label
            text={itemTitle}
            fontWeight="bold"
            color={routeDuration ? '#01B719' : $textColor}
            fontSize={18}
            autoFontSize={true}
            flexGrow={1}
            maxFontSize={18}
            verticalTextAlignment="middle"
            textWrap={true}
        />
        <label visibility={itemSubtitle ? 'visible' : 'collapsed'} text={itemSubtitle} color={$subtitleColor} fontSize={13} maxLines={2} verticalTextAlignment="top" flexGrow={1} flexShrink={0} />
    </flexlayout>
    <canvaslabel {...$$restProps} fontSize="16">
        <cgroup verticalAlignment="middle" paddingBottom={(itemSubtitle ? 4 : 0) + (propsToDraw.length > 0 ? 12 : 0)}>
            <cspan visibility={itemIcon && itemIcon.length > 0 ? 'visible' : 'hidden'} paddingLeft="10" width="40" text={osmicon(itemIcon)} fontFamily="osm" fontSize={24} />
        </cgroup>
        <!-- <symbolshape
            visibility={showSymbol && itemProps && itemProps.symbol ? 'visible' : 'hidden'}
            symbol={(itemProps && itemProps.symbol) || null}
            color={(itemProps && itemProps.color) || null}
            width="34"
            height="34"
            top={propsToDraw.length > 0 ? 3 : 6}
        /> -->

        <cgroup fontSize="14" verticalAlignment="bottom" textAlignment="left" visibility={propsToDraw.length > 0 ? 'visible' : 'hidden'}>
            {#each propsToDraw as prop, index}
                <cgroup>
                    <cspan fontFamily={mdiFontFamily} color="gray" text={propIcon(prop) + ' '} />
                    <cspan text={propValue(prop) + '  '} />
                </cgroup>
            {/each}
        </cgroup>
    </canvaslabel>
</gridlayout>
