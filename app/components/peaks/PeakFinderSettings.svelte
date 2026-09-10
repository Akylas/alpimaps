<script lang="ts">
    /**
     * The peak finder's settings, behind the cog in its overlay.
     *
     * Grouped the way the render is actually built: what the camera sees, what the summit labels do, and
     * what the outline effect draws. The outline group is the one worth tuning on a device against the
     * WebView version — see `~/mapModules/terrain/reliefShaders.ts` for what each knob does and why the
     * defaults are the web's rather than the SDK demo's.
     */
    import { lc } from '~/helpers/locale';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import {
        peakFinderCreaseStrength,
        peakFinderDark,
        peakFinderDepthBias,
        peakFinderDepthGain,
        peakFinderDistanceFade,
        peakFinderFlyElevation,
        peakFinderHaze,
        peakFinderHorizonBoost,
        peakFinderLabelAngle,
        peakFinderLabelBand,
        peakFinderLabelMaxDistance,
        peakFinderLabelPinTop,
        peakFinderLabelRows,
        peakFinderLinesOnly,
        peakFinderOcclusion,
        peakFinderOutlineSymmetric,
        peakFinderOutlineWidth,
        peakFinderShadeStrength,
        peakFinderTilt,
        peakFinderViewDistance
    } from '~/stores/terrainStore';
    import { colors, windowInset } from '~/variables';

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);
</script>

<scrollview backgroundColor={colorSurfaceContainer}>
    <!-- the inset goes on the content: scrollview takes no padding -->
    <stacklayout paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} paddingTop={10}>
        <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="4 16 4 16" text={lc('view').toUpperCase()} />
        <StoreSwitch store={peakFinderDark} title={lc('dark_mode')} />
        <!-- the FLY-IN elevation, not the live one: the live viewpoint is the slider on the panorama
             itself, which has to move the camera as it is dragged -->
        <StoreSlider format={(value) => `${Math.round(value)} m`} max={6000} min={0} step={50} store={peakFinderFlyElevation} title={lc('viewpoint_elevation')} />
        <StoreSlider format={(value) => `${Math.round(value)}°`} max={80} min={1} step={1} store={peakFinderTilt} title={lc('tilt')} />
        <StoreSlider format={(value) => `${value.toFixed(1)}×`} max={6} min={0.5} step={0.5} store={peakFinderViewDistance} title={lc('view_distance_factor')} />
        <StoreSlider format={(value) => value.toFixed(2)} max={0.5} min={0} step={0.01} store={peakFinderOcclusion} title={lc('label_occlusion_tolerance')} />

        <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={lc('summit_labels').toUpperCase()} />
        <StoreSwitch description={lc('label_pin_top_desc')} store={peakFinderLabelPinTop} title={lc('label_pin_top')} />
        <StoreSlider format={(value) => `${Math.round(value * 100)}%`} max={0.6} min={0} step={0.05} store={peakFinderLabelBand} title={lc('label_band')} />
        <StoreSlider format={(value) => `${Math.round(value)}°`} max={90} min={0} step={5} store={peakFinderLabelAngle} title={lc('label_angle')} />
        <StoreSlider format={(value) => String(Math.round(value))} max={4} min={1} step={1} store={peakFinderLabelRows} title={lc('label_rows')} />
        <StoreSlider format={(value) => (value === 0 ? lc('no_limit') : formatDistance(value))} max={300000} min={0} step={10000} store={peakFinderLabelMaxDistance} title={lc('label_max_distance')} />

        <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={lc('outline').toUpperCase()} />
        <StoreSwitch description={lc('lines_only_desc')} store={peakFinderLinesOnly} title={lc('lines_only')} />
        <StoreSwitch description={lc('outline_symmetric_desc')} store={peakFinderOutlineSymmetric} title={lc('outline_symmetric')} />
        <StoreSlider format={(value) => value.toFixed(1)} max={4} min={0.5} step={0.1} store={peakFinderOutlineWidth} title={lc('outline_width')} />
        <StoreSlider format={(value) => value.toFixed(1)} max={40} min={1} step={0.5} store={peakFinderDepthGain} title={lc('depth_gain')} />
        <StoreSlider format={(value) => value.toFixed(2)} max={2} min={0.05} step={0.01} store={peakFinderDepthBias} title={lc('depth_biais')} />
        <StoreSlider format={(value) => value.toFixed(2)} max={1} min={0} step={0.05} store={peakFinderDistanceFade} title={lc('distance_fade')} />
        <StoreSlider format={(value) => value.toFixed(1)} max={6} min={0} step={0.1} store={peakFinderHorizonBoost} title={lc('horizon_boost')} />
        <StoreSlider format={(value) => value.toFixed(2)} max={1} min={0} step={0.05} store={peakFinderCreaseStrength} title={lc('crease_strength')} />
        <StoreSlider format={(value) => value.toFixed(2)} max={1} min={0} step={0.05} store={peakFinderHaze} title={lc('haze')} />
        <StoreSlider
            format={(value) => value.toFixed(2)}
            max={1}
            min={0}
            step={0.05}
            store={peakFinderShadeStrength}
            title={lc('shade_strength')}
            visibility={$peakFinderLinesOnly ? 'collapse' : 'visible'} />
    </stacklayout>
</scrollview>
