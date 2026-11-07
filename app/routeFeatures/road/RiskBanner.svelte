<script lang="ts">
    // while following a bike route: a card under the maneuver card when a fast road without a separated lane is near
    // or underfoot, with its speed sign and what is left of it. Banner only: no sound, no vibration. The cross hides
    // it until the next section
    import NavigationCard from '~/components/navigation/NavigationCard.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import { lc } from '~/helpers/locale';
    import { isEInk } from '~/helpers/theme';
    import { riskAhead } from '~/routeFeatures/road/ahead';
    import { readRoad, roadWords } from '~/routeFeatures/road/read';
    import { roadBanner, roadBannerLead, roadBannerMinLength } from '~/routeFeatures/road/settings';
    import { routeFeatureChanges } from '~/routeFeatures/registry';
    import { navigationDetour, navigationItem, navigationProgress, navigationScale } from '~/stores/navigationStore';
    import { colors, fonts } from '~/variables';

    let { colorError, colorOnSurface, colorOnSurfaceVariant } = $colors;
    $: ({ colorError, colorOnSurface, colorOnSurfaceVariant } = $colors);

    const SIGN_SIZE = 38;

    // the `>= 0` only makes the statement depend on the settings changing what is read
    $: read = $routeFeatureChanges >= 0 ? readRoad($navigationItem) : null;
    // on a detour the progress is the base route's rejoin point: what is counted from it is not where the user is
    $: ahead = $roadBanner && read && !$navigationDetour ? riskAhead(read.runs, $navigationItem.profile.data, $navigationProgress?.onPathIndex ?? -1, { lead: $roadBannerLead, minLength: $roadBannerMinLength }) : null;

    // the section the user sent away stays away, until another one comes
    let dismissed: number = null;
    let dismissedFor = null;
    $: if ($navigationItem !== dismissedFor) {
        dismissedFor = $navigationItem;
        dismissed = null;
    }
    $: shown = ahead && ahead.key !== dismissed ? ahead : null;
    $: scale = $navigationScale;
    $: title = shown?.state === 'on' ? lc('road_banner_on') : shown ? lc('road_banner_ahead', formatDistance(shown.distance)) : '';
    $: detail = shown
        ? [roadWords.speed(shown.speed), lc(shown.level === 3 ? 'road_level_high' : 'road_level_medium'), shown.state === 'on' ? lc('road_banner_left', formatDistance(shown.remaining)) : null].filter(Boolean).join(' · ')
        : '';
</script>

<NavigationCard borderColor={isEInk ? '#000000' : colorError} borderWidth={2} columns="auto,*,auto" height={Math.round(58 * scale)} padding="0 6 0 10" visibility={shown ? 'visible' : 'collapse'} {...$$restProps}>
    <!-- the speed sign: a white disc in a ring -->
    <gridlayout
        backgroundColor="#ffffff"
        borderColor={isEInk ? '#000000' : colorError}
        borderRadius={(SIGN_SIZE * scale) / 2}
        borderWidth={3}
        height={Math.round(SIGN_SIZE * scale)}
        verticalAlignment="middle"
        width={Math.round(SIGN_SIZE * scale)}>
        <label color="#1b1c1d" fontSize={12 * scale} fontWeight="bold" horizontalAlignment="center" text={shown ? roadWords.speedNumber(shown.speed) : ''} verticalAlignment="middle" />
    </gridlayout>
    <stacklayout col={1} margin="0 8" verticalAlignment="middle">
        <label color={colorOnSurface} fontSize={15 * scale} fontWeight="bold" lineBreak="end" maxLines={1} text={title} />
        <label color={colorOnSurfaceVariant} fontSize={12.5 * scale} lineBreak="end" maxLines={1} text={detail} />
    </stacklayout>
    <label
        col={2}
        color={colorOnSurfaceVariant}
        fontFamily={$fonts.mdi}
        fontSize={22 * scale}
        height={Math.round(44 * scale)}
        text="mdi-close"
        textAlignment="center"
        verticalTextAlignment="center"
        width={Math.round(44 * scale)}
        on:tap={() => (dismissed = shown?.key ?? null)} />
</NavigationCard>
