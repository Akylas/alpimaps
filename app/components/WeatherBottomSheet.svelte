<script lang="ts">
    import { actionBarHeight, navigationBarHeight, screenHeightDips, statusBarHeight } from '~/variables';
    import TopWeatherView from './weather/TopWeatherView.svelte';

    let topHeight = Math.max(
        Math.min(screenHeightDips - actionBarHeight - navigationBarHeight - statusBarHeight - 100, 500),
        400
    );
    export let item;
</script>

<scrollview height={topHeight}>
    <TopWeatherView {item} height={topHeight} />
</scrollview>
