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
    import SpeedSign from '~/routeFeatures/road/SpeedSign.svelte';
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
    let dismissed: { item: unknown; key: number } | null = null;
    $: shown = ahead && !(dismissed?.item === $navigationItem && dismissed.key === ahead.key) ? ahead : null;
    $: scale = $navigationScale;

    function dismiss() {
        if (shown) {
            dismissed = { item: $navigationItem, key: shown.key };
        }
    }
</script>

{#if shown}
    {@const title = shown.state === 'on' ? lc('road_banner_on') : lc('road_banner_ahead', formatDistance(shown.distance))}
    {@const detail = [roadWords.speed(shown.speed), lc(shown.level === 3 ? 'road_level_high' : 'road_level_medium'), shown.state === 'on' ? lc('road_banner_left', formatDistance(shown.remaining)) : null].filter(Boolean).join(' · ')}
    <NavigationCard borderColor={isEInk ? '#000000' : colorError} borderWidth={2} columns="auto,*,auto" height={Math.round(58 * scale)} padding="0 6 0 10" {...$$restProps}>
        <SpeedSign fontSize={12 * scale} ringColor={colorError} size={Math.round(SIGN_SIZE * scale)} text={roadWords.speedNumber(shown.speed)} />
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
            on:tap={dismiss} />
    </NavigationCard>
{/if}
