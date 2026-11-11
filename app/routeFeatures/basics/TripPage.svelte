<script lang="ts">
    // dock page: the trip so far
    import { lc } from '@nativescript-community/l';
    import NavigationInfo from '~/components/navigation/NavigationInfo.svelte';
    import NavigationPageHeader from '~/components/navigation/NavigationPageHeader.svelte';
    import { navigationStats } from '~/stores/navigationStore';
    import { splitDistance, splitDuration, splitElevation, splitSpeed } from '~/utils/navigation';
    import { colors } from '~/variables';

    export let height: number;

    $: ({ colorHairline } = $colors);

    $: stats = $navigationStats;
    $: doneParts = stats ? splitDistance(stats.distance || 0) : null;
    $: climbedParts = stats ? splitElevation(stats.altitudeGain || 0) : null;
    $: movingParts = stats ? splitDuration((stats.duration || 0) / 1000) : null;
    $: speedParts = stats ? splitSpeed(stats.averageSpeed || 0) : null;
</script>

<gridlayout {height} rows="auto,*" {...$$restProps}>
    <NavigationPageHeader title={lc('navigation_trip')} />
    <!-- hairlines between the figures, like the map's button bar -->
    <gridlayout columns="*,*,*,*" row={1}>
        <NavigationInfo label={lc('navigation_moving')} unit={movingParts?.[1]} value={movingParts ? movingParts[0] : '-'} valueFontSize={20} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={1}
            label={lc('navigation_done')}
            paddingLeft={10}
            unit={doneParts?.[1]}
            value={doneParts ? doneParts[0] + '' : '-'}
            valueFontSize={20} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={2}
            label={lc('navigation_average_speed')}
            paddingLeft={10}
            unit={speedParts?.[1]}
            value={speedParts ? speedParts[0] + '' : '-'}
            valueFontSize={20} />
        <NavigationInfo
            borderColor={colorHairline}
            borderLeftWidth={1}
            col={3}
            label={lc('navigation_climbed')}
            paddingLeft={10}
            unit={climbedParts?.[1]}
            value={climbedParts ? '+' + climbedParts[0] : '-'}
            valueFontSize={20} />
    </gridlayout>
</gridlayout>
