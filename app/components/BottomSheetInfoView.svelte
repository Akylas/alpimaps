<script lang="ts" context="module">
    import ItemFormatter, { formatter } from '~/mapModules/ItemFormatter';
    import { convertElevation } from '~/helpers/formatter';
    import { IItem } from '~/models/Item';
    import { alert } from '@nativescript-community/ui-material-dialogs';
    import { fonticon } from 'nativescript-akylas-fonticon';
    import { mdiFontFamily } from '~/variables';

    const PROPS_TO_SHOW = ['ele'];
</script>

<script lang="ts">
    export let item: IItem;
    export let updating: boolean = false;

    let propsToDraw = [];
    $: {
        if (item) {
            const props = item.properties;
            if (props) {
                propsToDraw = PROPS_TO_SHOW.filter((k) => props.hasOwnProperty(k));
            } else {
                propsToDraw = [];
            }
        } else {
            propsToDraw = [];
        }
    }
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

    let columns = '';
    $: {
        columns = `auto,${Array(propsToDraw.length + 1).join('*,')}auto`;
    }

    let itemIcon: string[] = null;
    $: {
        itemIcon = item && formatter.geItemIcon(item);
    }

    let itemTitle: string = null;
    $: {
        itemTitle = item && formatter.getItemTitle(item);
    }
    let itemSubtitle: string = null;
    $: {
        itemSubtitle = item && formatter.getItemSubtitle(item);
    }
    // @Watch('routeItem')
    // onRouteChanged() {
    //     if (currentLocation) {
    //         updateRouteItemWithPosition(currentLocation);
    //     }
    // }

    function showRawData() {
        const { zoomBounds, route, styleOptions, vectorElement, ...others } = item;
        alert(JSON.stringify(others, null, 2));
    }
</script>

<canvaslabel {...$$restProps} fontSize="16" color="white" padding="5 5 5 5">
    <cgroup verticalAlignment="middle" paddingBottom={itemSubtitle ? 10 : 0 + propsToDraw.length > 0 ? 5 : 0}>
        <cspan
            visibility={itemIcon ? 'visible' : 'hidden'}
            paddingLeft="10"
            width="40"
            text={fonticon(itemIcon)}
            fontFamily="osm"
            fontSize={24} />
    </cgroup>
    <cgroup
        paddingLeft="40"
        paddingBottom={itemSubtitle ? 10 : 0 + propsToDraw.length > 0 ? 5 : 0}
        verticalAlignment="middle"
        textAlignment="left">
        <cspan text={itemTitle} fontWeight="bold" />
        <cspan text={itemSubtitle ? '\n' + itemSubtitle : ''} color="#D0D0D0" fontSize={13} />
    </cgroup>
    {#each propsToDraw as prop, index}
        <cgroup fontSize="14" paddingLeft={5 + index * 60} verticalAlignment="bottom" textAlignment="left">
            <cspan fontFamily={mdiFontFamily} color="gray" :text={propIcon(prop)} />
            <cspan text={propValue(prop)} />
        </cgroup>
    {/each}
</canvaslabel>
