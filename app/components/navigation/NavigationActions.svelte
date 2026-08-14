<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { showError } from '@shared/utils/showError';
    import IconButton from '~/components/common/IconButton.svelte';
    import NavigationCard, { CARD_RADIUS } from '~/components/navigation/NavigationCard.svelte';
    import { formatter } from '~/mapModules/ItemFormatter';
    import { getMapContext, handleMapAction } from '~/mapModules/MapModule';
    import { navigationService } from '~/services/NavigationService';
    import { packageService } from '~/services/PackageService';
    import { navigationItem, navigationScale } from '~/stores/navigationStore';
    import { NAVBUTTON_SIZE } from '~/utils/navigation';
    import { hideLoading, showLoading } from '~/utils/ui/index.common';

    const mapContext = getMapContext();

    /** the same buttons the controls use, so the two rows of the sheet read as one interface */
    $: buttonSize = Math.round(NAVBUTTON_SIZE * $navigationScale);

    $: item = $navigationItem;
    // a route that was never saved has nothing to compute against, and a profile it already has does
    // not need computing again
    $: canQueryProfile = !!item?.id && !item?.profile?.data?.length;
    $: canQueryStats = !!item?.id && !item?.stats;

    async function getProfile() {
        try {
            await showLoading(lc('elevation_profile'));
            const profile = await packageService.getElevationProfile(item);
            if (profile) {
                await navigationService.updateNavigatedItem({ profile });
            }
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }
    async function getStats() {
        try {
            await showLoading(lc('road_stats'));
            const stats = await packageService.fetchStats({ item, projection: mapContext.getProjection() });
            if (stats) {
                await navigationService.updateNavigatedItem({ stats });
            }
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }
    /**
     * Sun and moon where the user actually is, which is the question asked on the way rather than at
     * home. `handleMapAction` defaults to the last user location, so nothing has to be passed for it.
     */
    async function showAstronomy() {
        try {
            await handleMapAction('astronomy', { name: item ? formatter.getItemTitle(item) : undefined });
        } catch (error) {
            showError(error);
        }
    }

    /**
     * The row as data, like the item sheet builds its own: an action that does not apply is simply not
     * listed, rather than a fixed set of buttons each hiding itself.
     */
    $: actions = [
        { id: 'profile', when: canQueryProfile, text: 'mdi-chart-areaspline', tooltip: lc('elevation_profile'), tap: getProfile },
        { id: 'stats', when: canQueryStats, text: 'mdi-chart-bar-stacked', tooltip: lc('road_stats'), tap: getStats },
        { id: 'astronomy', when: true, text: 'mdi-weather-night', tooltip: lc('astronomy'), tap: showAstronomy }
    ].filter((action) => action.when);
</script>

<!-- its own step of the sheet, above the bar: these all take a moment and a look, so they are something
     the user drags up to rather than something sitting in the way while riding -->
<NavigationCard height={buttonSize} visibility={actions.length ? 'visible' : 'collapse'} {...$$restProps}>
    <scrollview borderRadius={CARD_RADIUS} orientation="horizontal">
        <stacklayout orientation="horizontal">
            {#each actions as action (action.id)}
                <IconButton id={action.id} rounded={false} size={buttonSize} text={action.text} tooltip={action.tooltip} on:tap={action.tap} />
            {/each}
        </stacklayout>
    </scrollview>
</NavigationCard>
