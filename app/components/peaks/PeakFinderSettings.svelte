<script lang="ts">
    /**
     * The peak finder's settings, behind the cog in its overlay.
     *
     * Grouped the way the render is actually built: what the camera sees, what the summit labels do, and
     * what the outline effect draws. Every default is the android demo's — see
     * `~/mapModules/terrain/reliefShaders.ts` and `~/stores/terrainStore.ts`.
     *
     * A COLLECTIONVIEW of DATA rows, like `Terrain3DSettings` — see the note there for why (a long
     * stacklayout of sliders is built and measured in full while the sheet opens) and for what each
     * `type` maps to.
     */
    import { Template } from '@nativescript-community/svelte-native/components';
    import type { Writable } from 'svelte/store';
    import { lc } from '~/helpers/locale';
    import StoreSegment from '~/components/settings/StoreSegment.svelte';
    import StoreSlider from '~/components/settings/StoreSlider.svelte';
    import StoreSwitch from '~/components/settings/StoreSwitch.svelte';
    import { formatDistance } from '~/helpers/formatter';
    import {
        peakFinderCreaseFade,
        peakFinderCreaseStrength,
        peakFinderCreaseThreshold,
        peakFinderDark,
        peakFinderDistanceFade,
        peakFinderFlyElevation,
        peakFinderHaze,
        peakFinderHorizonBoost,
        peakFinderLabelAngle,
        peakFinderLabelBand,
        peakFinderLabelMaxDistance,
        peakFinderLabelMinDistance,
        peakFinderLabelPinTop,
        peakFinderLabelRows,
        peakFinderLensCorrection,
        peakFinderMaxFieldOfView,
        peakFinderMeshResolution,
        peakFinderOcclusion,
        peakFinderOutlineWidth,
        peakFinderScreenOrientation,
        peakFinderShadeStrength,
        peakFinderSlopeBias,
        peakFinderSlopeMultiplier,
        peakFinderSlopeStrength,
        peakFinderTilt,
        peakFinderViewDistance,
        peakFinderViewDistanceMetres
    } from '~/stores/terrainStore';
    import { colors, screenHeightDips, windowInset } from '~/variables';

    interface SettingRow {
        type: 'sectionheader' | 'switch' | 'slider' | 'segment';
        title: string;
        description?: string;
        store?: Writable<any>;
        min?: number;
        max?: number;
        step?: number;
        format?: (value: number) => string;
        options?: { value: string; title: string }[];
    }

    $: ({ colorOnSurfaceVariant, colorSurfaceContainer } = $colors);

    const orientations = [
        { value: 'auto', title: lc('auto') },
        { value: 'landscape', title: lc('landscape') },
        { value: 'portrait', title: lc('portrait') }
    ];

    const section = (title: string): SettingRow => ({ type: 'sectionheader', title: title.toUpperCase() });
    const degrees = (value: number) => `${Math.round(value)}°`;
    const hundredths = (value: number) => value.toFixed(2);
    const whole = (value: number) => String(Math.round(value));

    const rows: SettingRow[] = [
        section(lc('view')),
        { type: 'switch', store: peakFinderDark, title: lc('dark_mode') },
        { type: 'segment', store: peakFinderScreenOrientation, title: lc('screen_orientation'), description: lc('screen_orientation_desc'), options: orientations },
        // the FLY-IN elevation, not the live one: the live viewpoint is the slider on the panorama
        // itself, which has to move the camera as it is dragged
        { type: 'slider', store: peakFinderFlyElevation, title: lc('viewpoint_elevation'), min: 0, max: 6000, step: 50, format: (value) => `${Math.round(value)} m` },
        { type: 'slider', store: peakFinderTilt, title: lc('tilt'), min: 0, max: 80, step: 1, format: degrees },
        {
            type: 'slider',
            store: peakFinderMaxFieldOfView,
            title: lc('max_field_of_view'),
            description: lc('max_field_of_view_desc'),
            min: 0,
            max: 140,
            step: 5,
            format: (value) => (value === 0 ? lc('match_camera') : degrees(value))
        },
        { type: 'switch', store: peakFinderLensCorrection, title: lc('lens_correction'), description: lc('lens_correction_desc') },
        { type: 'slider', store: peakFinderViewDistance, title: lc('view_distance_factor'), min: 0.5, max: 6, step: 0.5, format: (value) => `${value.toFixed(1)}×` },
        {
            type: 'slider',
            store: peakFinderViewDistanceMetres,
            title: lc('viewing_distance'),
            description: lc('viewing_distance_desc'),
            min: 10000,
            max: 400000,
            step: 10000,
            format: formatDistance
        },
        // 96 and no further: TerrainRenderer's MAX_MESH_GRID_SIZE clamps the un-draped surface there
        { type: 'slider', store: peakFinderMeshResolution, title: lc('mesh_resolution'), description: lc('mesh_resolution_desc'), min: 16, max: 256, step: 16, format: whole },
        { type: 'slider', store: peakFinderOcclusion, title: lc('label_occlusion_tolerance'), min: 0, max: 0.5, step: 0.01, format: hundredths },

        section(lc('summit_labels')),
        { type: 'switch', store: peakFinderLabelPinTop, title: lc('label_pin_top'), description: lc('label_pin_top_desc') },
        { type: 'slider', store: peakFinderLabelBand, title: lc('label_band'), min: 0, max: 0.6, step: 0.05, format: (value) => `${Math.round(value * 100)}%` },
        { type: 'slider', store: peakFinderLabelAngle, title: lc('label_angle'), min: 0, max: 90, step: 5, format: degrees },
        { type: 'slider', store: peakFinderLabelRows, title: lc('label_rows'), description: lc('label_rows_desc'), min: 1, max: 6, step: 1, format: whole },
        {
            type: 'slider',
            store: peakFinderLabelMinDistance,
            title: lc('label_min_distance'),
            description: lc('label_min_distance_desc'),
            min: 0,
            max: 40,
            step: 1,
            format: (value) => (value === 0 ? lc('no_limit') : `${Math.round(value)} px`)
        },
        {
            type: 'slider',
            store: peakFinderLabelMaxDistance,
            title: lc('label_max_distance'),
            min: 0,
            max: 300000,
            step: 10000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        },

        section(lc('relief')),
        // the slope ink comes first: it is what draws the relief between the ridges
        { type: 'slider', store: peakFinderSlopeStrength, title: lc('slope_lines'), description: lc('slope_lines_desc'), min: 0, max: 1, step: 0.05, format: hundredths },
        {
            type: 'slider',
            store: peakFinderSlopeMultiplier,
            title: lc('slope_lines_amount'),
            description: lc('slope_lines_amount_desc'),
            min: 0,
            max: 100,
            step: 0.5,
            format: (value) => value.toFixed(1)
        },
        { type: 'slider', store: peakFinderSlopeBias, title: lc('slope_lines_contrast'), description: lc('slope_lines_contrast_desc'), min: 0.05, max: 2, step: 0.01, format: hundredths },
        { type: 'slider', store: peakFinderShadeStrength, title: lc('shade_strength'), min: 0, max: 1, step: 0.05, format: hundredths },
        { type: 'slider', store: peakFinderHaze, title: lc('haze'), min: 0, max: 1, step: 0.05, format: hundredths },
        { type: 'slider', store: peakFinderOutlineWidth, title: lc('outline_width'), min: 0.5, max: 4, step: 0.1, format: (value) => value.toFixed(1) },
        { type: 'slider', store: peakFinderDistanceFade, title: lc('distance_fade'), min: 0, max: 1, step: 0.05, format: hundredths },
        { type: 'slider', store: peakFinderHorizonBoost, title: lc('horizon_boost'), min: 0, max: 6, step: 0.1, format: (value) => value.toFixed(1) },
        { type: 'slider', store: peakFinderCreaseStrength, title: lc('crease_strength'), min: 0, max: 1, step: 0.05, format: hundredths },
        { type: 'slider', store: peakFinderCreaseThreshold, title: lc('crease_threshold'), description: lc('crease_threshold_desc'), min: 0.02, max: 0.5, step: 0.01, format: hundredths },
        { type: 'slider', store: peakFinderCreaseFade, title: lc('crease_fade'), description: lc('crease_fade_desc'), min: 0, max: 1, step: 0.05, format: hundredths }
    ];

    function itemTemplateSelector(item: SettingRow) {
        return item.type;
    }
</script>

<gesturerootview backgroundColor={colorSurfaceContainer} height={Math.round(screenHeightDips * 0.3)}>
    <!-- the inset goes on the content: the collectionview scrolls under it -->
    <collectionview {itemTemplateSelector} items={rows} ios:contentInsetAdjustmentBehavior={2} paddingBottom={10 + (__ANDROID__ ? $windowInset.bottom : 0)} paddingTop={10}>
        <Template key="sectionheader" let:item>
            <label class="sectionHeader" color={colorOnSurfaceVariant} fontSize={13} padding="12 16 4 16" text={item.title} />
        </Template>
        <Template key="switch" let:item>
            <StoreSwitch description={item.description} store={item.store} title={item.title} />
        </Template>
        <Template key="segment" let:item>
            <StoreSegment description={item.description} options={item.options} store={item.store} title={item.title} />
        </Template>
        <Template key="slider" let:item>
            <StoreSlider description={item.description} format={item.format} max={item.max} min={item.min} step={item.step} store={item.store} title={item.title} />
        </Template>
    </collectionview>
</gesturerootview>
