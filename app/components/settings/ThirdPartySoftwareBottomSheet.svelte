<script lang="ts">
    import { Template } from '@nativescript-community/svelte-native/components';
    import { openLink } from '~/utils/ui/index.common';
    import ListItemAutoSize from '~/components/common/ListItemAutoSize.svelte';
    // technique for only specific properties to get updated on store change

    const licences = require('~/licenses.json');

    const items = [
        {
            moduleName: 'Material Design Icons',
            moduleUrl: 'https://pictogrammers.com/library/mdi/'
        },
        {
            moduleName: 'OpenStreetMap',
            moduleUrl: 'https://www.openstreetmap.org/copyright'
        },
        {
            moduleName: 'Valhalla',
            moduleUrl: 'https://github.com/valhalla/valhalla'
        },
        {
            moduleName: 'Valhalla Server',
            moduleUrl: 'https://valhalla1.openstreetmap.de'
        },
        {
            moduleName: 'NativeScript',
            moduleUrl: 'https://github.com/NativeScript/NativeScript'
        }
    ].concat(licences.dependencies);

    function onTap(item) {
        if (item.moduleUrl) {
            openLink(item.moduleUrl);
        }
    }
</script>

<gesturerootview height="300">
    <collectionView id="scrollView" ios:contentInsetAdjustmentBehavior={2} itemIdGenerator={(item, i) => i} {items}>
        <Template let:item>
            <ListItemAutoSize item={{ title: item.moduleName, subtitle: item.moduleUrl }} on:tap={() => onTap(item)} />
        </Template>
    </collectionView>
</gesturerootview>
