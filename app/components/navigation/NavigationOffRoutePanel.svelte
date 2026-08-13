<script lang="ts">
    import { lc } from '@nativescript-community/l';
    import { showError } from '@shared/utils/showError';
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { navigationService } from '~/services/NavigationService';
    import { isNavigationRunning, navigationProgress, navigationRerouting } from '~/stores/navigationStore';
    import { splitDistance } from '~/utils/navigation';
    import { colors, fontScaleMaxed } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorPrimary } = $colors);

    // floats above the navigation sheet rather than living inside it: the sheet has fixed steps, and a
    // panel that only exists sometimes must not be what decides how tall a step is
    $: offRoute = $isNavigationRunning && !!$navigationProgress?.offRoute;
    $: distanceParts = $navigationProgress?.distanceFromRoute > 0 ? splitDistance($navigationProgress.distanceFromRoute) : null;
    $: message = $navigationRerouting ? lc('navigation_rerouting') : distanceParts ? lc('navigation_off_route_by', distanceParts[0] + ' ' + distanceParts[1]) : lc('navigation_off_route');

    async function backToRoute() {
        try {
            await navigationService.backToRoute();
        } catch (error) {
            showError(error);
        }
    }
    async function rerouteToDestination() {
        try {
            await navigationService.rerouteToDestination();
        } catch (error) {
            showError(error);
        }
    }
</script>

<!-- one card: the state is a plain line of text, and the two ways out of it are real buttons, so what
     is tappable is not something the user has to work out while moving -->
<NavigationCard
    columns="*,auto,auto"
    horizontalAlignment="left"
    marginBottom={6}
    marginLeft={8}
    marginRight={8}
    padding="4 6 4 12"
    verticalAlignment="bottom"
    visibility={offRoute ? 'visible' : 'collapse'}
    {...$$restProps}>
    <label color={colorOnSurfaceVariant} fontSize={15 * $fontScaleMaxed} marginRight={8} text={message} verticalAlignment="center" />
    <mdbutton col={1} fontSize={14 * $fontScaleMaxed} isEnabled={!$navigationRerouting} text={lc('navigation_back_to_route')} variant="outline" verticalAlignment="center" on:tap={backToRoute} />
    <mdbutton
        col={2}
        color={colorPrimary}
        fontSize={14 * $fontScaleMaxed}
        isEnabled={!$navigationRerouting}
        marginLeft={4}
        text={lc('navigation_reroute_to_destination')}
        variant="text"
        verticalAlignment="center"
        on:tap={rerouteToDestination} />
</NavigationCard>
