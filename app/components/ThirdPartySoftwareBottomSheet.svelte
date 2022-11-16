<script lang="ts">
    import { Template } from 'svelte-native/components';
    import { openLink } from '~/utils/ui';
    import { primaryColor } from '~/variables';
    let licenses: { dependencies?: any[] } = {};
    let items;
    try {
        licenses = require('~/licenses.json');
        items = licenses.dependencies;
    } catch (error) {
        console.error(error, error.stack);
    }
    //@ts-ignore

    function onTap(item) {
        if (item.moduleUrl) {
            openLink(item.moduleUrl);
        }
    }
</script>

<collectionView id="trackingScrollView" {items} rowHeight={60} itemIdGenerator={(item, i) => i} class="bottomsheet" height={300}>
    <Template let:item>
        <stackLayout padding="0 16 0 16" rippleColor={primaryColor} on:tap={() => onTap(item)} verticalAlignment="middle">
            <label text={item.moduleName} verticalAlignment="top" fontSize={17} maxLines={1} />
            <label text={item.moduleUrl} color="#aaaaaa" verticalAlignment="bottom" fontSize={14} />
        </stackLayout>
    </Template>
</collectionView>
