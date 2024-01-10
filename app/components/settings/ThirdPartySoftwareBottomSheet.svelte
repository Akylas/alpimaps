<script lang="ts">
    import { Template } from 'svelte-native/components';
    import { openLink } from '~/utils/ui';
    import { colors } from '~/variables';
    $: ({ colorPrimary } = $colors);
    let licenses: { dependencies?: any[] } = {};
    let items;
    try {
        licenses = require('~/licenses.json');
        items = licenses.dependencies;
    } catch (error) {
        console.error(error, error.stack);
    }

    function onTap(item) {
        if (item.moduleUrl) {
            openLink(item.moduleUrl);
        }
    }
</script>

<collectionView id="trackingScrollView" class="bottomsheet" height={300} itemIdGenerator={(item, i) => i} {items} rowHeight={60}>
    <Template let:item>
        <stacklayout padding="0 16 0 16" rippleColor={colorPrimary} verticalAlignment="middle" on:tap={() => onTap(item)}>
            <label fontSize={17} maxLines={1} text={item.moduleName} verticalAlignment="top" />
            <label color="#aaaaaa" fontSize={14} text={item.moduleUrl} verticalAlignment="bottom" />
        </stacklayout>
    </Template>
</collectionView>
