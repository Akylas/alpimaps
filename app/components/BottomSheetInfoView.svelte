<script lang="ts">
    import dayjs from 'dayjs';
    import { convertDurationSeconds, convertElevation, convertValueToUnit, osmicon, UNITS } from '~/helpers/formatter';
    import { formatter } from '~/mapModules/ItemFormatter';
    import type { IItem as Item, ItemProperties } from '~/models/Item';
    import { alpimapsFontFamily, mdiFontFamily, subtitleColor, textColor } from '~/variables';
    const PROPS_TO_SHOW = ['ele'];

    export let item: Item;
    let itemIcon: string = null;
    let itemIconFontFamily = 'osm';
    let itemTitle: string = null;
    let itemSubtitle: string = null;
    let propsToDraw = [];
    let routeDistance = '';
    let routeDuration: string = null;
    let routeDplus: string = null;
    let hasProfile = false;
    let routeDmin: string = null;
    let showSymbol: boolean = false;
    let actualShowSymbol = false;
    let itemIsRoute = false;
    let itemProps: ItemProperties = null;

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
                return 'mdi-arrow-top-right';
            case 'dmin':
                return 'mdi-arrow-bottom-right';
            case 'distance':
                return 'mdi-arrow-left-right';
            case 'duration':
                return 'mdi-timer-outline';
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
        itemIsRoute = !!item?.route;
        if (itemIsRoute && itemProps.route && (itemProps.route.type === 'pedestrian' || itemProps.route.type === 'bicycle')) {
            itemIcon = formatter.getRouteIcon(itemProps.route.type, itemProps.route.subtype);
            itemIconFontFamily = alpimapsFontFamily;
        } else {
            itemIcon = osmicon(formatter.geItemIcon(item));
            itemIconFontFamily = 'osm';
        }
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
            const route = item.route;
            let result;
            if (route.totalDistance || (itemProps && itemProps.distance)) {
                result = `${convertValueToUnit(route.totalDistance || itemProps.distance * 1000, UNITS.DistanceKm).join(' ')}`;
                routeDistance = result;
                newPropsToDraw.push('distance');
            }

            if (route.totalTime) {
                routeDuration = convertDurationSeconds(route.totalTime);
                newPropsToDraw.push('duration');
            }
        }

        hasProfile = !!item.profile?.max;
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
            const profile = item.profile;
            if (profile.dplus > 0) {
                routeDplus = `${convertElevation(profile.dplus)}`;
                newPropsToDraw.push('dplus');
            }
            if (profile.dmin < 0) {
                routeDmin = `${convertElevation(-profile.dmin)}`;
                newPropsToDraw.push('dmin');
            }
        }
        setTimeout(() => {
            propsToDraw = newPropsToDraw;
        }, 100);
    }
    $: {
        try {
            updateItem(item);
        } catch (err) {
            console.error('updateItem', err, err.stack);
        }
    }

    $: actualShowSymbol = showSymbol && itemProps && (itemProps.symbol || itemProps.network);
</script>

<gridlayout {...$$restProps} padding="5 10 4 10">
    <!-- <label
            verticalAlignment="top"
            horizontalAlignment="left"
            paddingTop={12}
            visibility={itemIcon  ? 'visible' : 'hidden'}
            paddingLeft={5}
            width={40}
            text={itemIcon}
            fontFamily={itemIconFontFamily}
            fontSize={24}
            color={(itemProps && itemProps.color) || $textColor}
        /> -->
    <canvaslabel fontSize={16}>
        <cspan
            verticalAlignment="top"
            paddingTop={12}
            visibility={itemIcon ? 'visible' : 'hidden'}
            paddingLeft={5}
            width={40}
            text={itemIcon}
            fontFamily={itemIconFontFamily}
            fontSize={24}
            color={(itemProps && itemProps.color) || $textColor}
        />
        <symbolshape
            visibility={actualShowSymbol ? 'visible' : 'hidden'}
            symbol={actualShowSymbol ? formatter.getSymbol(itemProps) : null}
            color={itemProps?.color || $textColor}
            width={34}
            height={34}
            top={8}
        />

        <cgroup fontSize={14} verticalAlignment="bottom" textAlignment="left" visibility={propsToDraw.length > 0 ? 'visible' : 'hidden'}>
            {#each propsToDraw as prop, index}
                <cgroup>
                    <cspan fontSize={18} fontFamily={mdiFontFamily} color="gray" text={propIcon(prop) + ' '} />
                    <cspan text={propValue(prop) + '  '} />
                </cgroup>
            {/each}
        </cgroup>
    </canvaslabel>
    <flexlayout marginLeft={40} marginBottom={20} flexDirection="column">
        <label text={itemTitle} fontWeight="bold" color={$textColor} fontSize={18} autoFontSize={true} flexGrow={1} maxFontSize={18} verticalTextAlignment="middle" textWrap={true} />
        <label visibility={itemSubtitle ? 'visible' : 'collapsed'} text={itemSubtitle} color={$subtitleColor} fontSize={13} maxLines={2} verticalTextAlignment="top" flexGrow={1} flexShrink={0} />
    </flexlayout>
</gridlayout>
