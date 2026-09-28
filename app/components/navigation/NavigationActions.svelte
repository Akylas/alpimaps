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

    $: buttonSize = Math.round(NAVBUTTON_SIZE * $navigationScale);

    $: item = $navigationItem;
    // an unsaved route (no id) has nothing to compute against
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
            const stats = await packageService.fetchStats({ item });
            if (stats) {
                await navigationService.updateNavigatedItem({ stats });
            }
        } catch (error) {
            showError(error);
        } finally {
            hideLoading();
        }
    }
    // handleMapAction defaults to the last user location
    async function showAstronomy() {
        try {
            await handleMapAction('astronomy', { name: item ? formatter.getItemTitle(item) : undefined });
        } catch (error) {
            showError(error);
        }
    }

    $: actions = [
        { id: 'profile', when: canQueryProfile, text: 'mdi-chart-areaspline', tooltip: lc('elevation_profile'), tap: getProfile },
        { id: 'stats', when: canQueryStats, text: 'mdi-chart-bar-stacked', tooltip: lc('road_stats'), tap: getStats },
        { id: 'astronomy', when: true, text: 'mdi-weather-night', tooltip: lc('astronomy'), tap: showAstronomy }
    ].filter((action) => action.when);
</script>

<NavigationCard height={buttonSize} visibility={actions.length ? 'visible' : 'collapse'} {...$$restProps}>
    <scrollview borderRadius={CARD_RADIUS} orientation="horizontal">
        <stacklayout orientation="horizontal">
            {#each actions as action (action.id)}
                <IconButton id={action.id} rounded={false} size={buttonSize} text={action.text} tooltip={action.tooltip} on:tap={action.tap} />
            {/each}
        </stacklayout>
    </scrollview>
</NavigationCard>
