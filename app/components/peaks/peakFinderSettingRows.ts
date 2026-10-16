import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { SettingsStore } from '~/stores/settingsStore';
import {
    type PeakFinderLook,
    peakFinderArHorizonBoost,
    peakFinderArOutlineWidth,
    peakFinderConstellationArt,
    peakFinderConstellations,
    peakFinderDark,
    peakFinderDetailFeatures,
    peakFinderDetailLevels,
    peakFinderDetailSource,
    peakFinderDrapeCacheSize,
    peakFinderExaggeration,
    peakFinderFlyElevation,
    peakFinderFog,
    peakFinderFogDistance,
    peakFinderHillshade,
    peakFinderHorizonBoost,
    peakFinderLabelAngle,
    peakFinderLabelLayout,
    peakFinderLabelMaxDistance,
    peakFinderLabelMinDistance,
    peakFinderLabelPadding,
    peakFinderLabelPersist,
    peakFinderLabelRowHeight,
    peakFinderLabelRows,
    peakFinderLabelTextSize,
    peakFinderLabelWrap,
    peakFinderLensCorrection,
    peakFinderLook,
    peakFinderMaxFieldOfView,
    peakFinderMeshResolution,
    peakFinderMoon,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderPeakZoom,
    peakFinderPlanets,
    peakFinderRealisticViewDistance,
    peakFinderScreenOrientation,
    peakFinderShadowStrength,
    peakFinderShadows,
    peakFinderSky,
    peakFinderStars,
    peakFinderStarsLabelsOnSummits,
    peakFinderStaticPeaks,
    peakFinderSun,
    peakFinderSunHours,
    peakFinderTerrainMaxZoom,
    peakFinderTileCoarsening,
    peakFinderTileLodFactor,
    peakFinderTilt,
    peakFinderViewDistanceMetres
} from '~/stores/terrainStore';

// One list shared by `PeakFinderSettings` and the `Settings` screen, so rows/ranges/formats cannot drift.
// `suntime` and `source` are panorama-only: the moment the sky is drawn for is not a persisted setting, and
// the imagery's options are those of a layer that only exists on the panorama.
export interface PeakFinderSettingRow {
    type: 'sectionheader' | 'switch' | 'slider' | 'segment' | 'suntime' | 'source';
    title: string;
    /** Listed with this look only; every row of a list built with no look. */
    only?: PeakFinderLook;
    description?: string;
    store?: SettingsStore<any>;
    min?: number;
    max?: number;
    step?: number;
    format?: (value: number) => string;
    options?: { value: string; title: string }[];
}

const section = (title: string, only?: PeakFinderLook): PeakFinderSettingRow => ({ type: 'sectionheader', title: title.toUpperCase(), only });
const degrees = (value: number) => `${Math.round(value)}°`;
const hundredths = (value: number) => value.toFixed(2);
const whole = (value: number) => String(Math.round(value));
const pixels = (value: number) => `${Math.round(value)} px`;

/** `look` hides the rows of the other look; none (the Settings screen) lists them all. */
export function peakFinderSettingRows(look?: PeakFinderLook): PeakFinderSettingRow[] {
    return rows().filter((row) => !look || !row.only || row.only === look);
}

function rows(): PeakFinderSettingRow[] {
    return [
        section(lc('look')),
        {
            type: 'segment',
            store: peakFinderLook,
            title: lc('look'),
            description: lc('look_desc'),
            options: [
                { value: 'relief', title: lc('relief') },
                { value: 'realistic', title: lc('look_realistic') }
            ]
        },
        { type: 'source', title: lc('imagery_source'), description: lc('imagery_source_desc'), only: 'realistic' },
        { type: 'switch', store: peakFinderSky, title: lc('panorama_sky'), description: lc('panorama_sky_desc'), only: 'realistic' },
        { type: 'switch', store: peakFinderFog, title: lc('fog'), description: lc('terrain_fog_desc'), only: 'realistic' },
        { type: 'slider', store: peakFinderFogDistance, title: lc('fog_distance'), description: lc('fog_distance_desc'), min: 0.2, max: 1, step: 0.05, format: hundredths, only: 'realistic' },
        { type: 'switch', store: peakFinderShadows, title: lc('shadows'), description: lc('panorama_shadows_desc'), only: 'realistic' },
        { type: 'slider', store: peakFinderShadowStrength, title: lc('shadow_strength'), min: 0, max: 1.5, step: 0.05, format: hundredths, only: 'realistic' },

        section(lc('view')),
        { type: 'switch', store: peakFinderDark, title: lc('dark_mode') },
        {
            type: 'segment',
            store: peakFinderScreenOrientation,
            title: lc('screen_orientation'),
            description: lc('screen_orientation_desc'),
            options: [
                { value: 'auto', title: lc('auto') },
                { value: 'landscape', title: lc('landscape') },
                { value: 'portrait', title: lc('portrait') }
            ]
        },
        // the FLY-IN elevation; the live one is the panorama's own control
        { type: 'slider', store: peakFinderFlyElevation, title: lc('viewpoint_elevation'), min: 0, max: 6000, step: 50, format: (value) => `+${formatDistance(value)}` },
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

        section(lc('sky')),
        { type: 'suntime', title: lc('sky_time') },
        { type: 'switch', store: peakFinderSun, title: lc('sun_path'), description: lc('sun_path_desc') },
        { type: 'switch', store: peakFinderSunHours, title: lc('sun_hours'), description: lc('sun_hours_desc') },
        { type: 'switch', store: peakFinderMoon, title: lc('moon_path'), description: lc('moon_path_desc') },
        { type: 'switch', store: peakFinderStars, title: lc('stars'), description: lc('stars_desc') },
        { type: 'switch', store: peakFinderConstellations, title: lc('constellations'), description: lc('constellations_desc') },
        { type: 'switch', store: peakFinderConstellationArt, title: lc('constellation_art'), description: lc('constellation_art_desc') },
        { type: 'switch', store: peakFinderPlanets, title: lc('planets'), description: lc('planets_desc') },
        { type: 'switch', store: peakFinderStarsLabelsOnSummits, title: lc('stars_labels_on_summits'), description: lc('stars_labels_on_summits_desc') },

        section(lc('summit_labels')),
        {
            type: 'segment',
            store: peakFinderLabelLayout,
            title: lc('label_layout'),
            options: [
                { value: 'top', title: lc('label_layout_top') },
                { value: 'band', title: lc('label_layout_band') },
                { value: 'skyline', title: lc('label_layout_skyline') }
            ]
        },
        {
            type: 'slider',
            store: peakFinderLabelRowHeight,
            title: lc('label_row_height'),
            description: lc('label_row_height_desc'),
            min: 0,
            max: 400,
            step: 5,
            format: (value) => (value === 0 ? lc('auto') : pixels(value))
        },
        { type: 'slider', store: peakFinderLabelAngle, title: lc('label_angle'), min: 0, max: 90, step: 1, format: degrees },
        {
            type: 'slider',
            store: peakFinderLabelMinDistance,
            title: lc('label_min_distance'),
            description: lc('label_min_distance_desc'),
            min: 0,
            max: 30,
            step: 1,
            format: (value) => (value === 0 ? lc('no_limit') : pixels(value))
        },
        { type: 'slider', store: peakFinderLabelRows, title: lc('label_rows'), description: lc('label_rows_desc'), min: 1, max: 5, step: 1, format: whole },
        { type: 'slider', store: peakFinderLabelTextSize, title: lc('label_text_size'), min: 8, max: 24, step: 0.5, format: (value) => value.toFixed(1) },
        {
            type: 'slider',
            store: peakFinderLabelWrap,
            title: lc('label_wrap'),
            description: lc('label_wrap_desc'),
            min: 0,
            max: 300,
            step: 5,
            format: (value) => (value === 0 ? lc('no_limit') : pixels(value))
        },
        {
            type: 'slider',
            store: peakFinderOcclusion,
            title: lc('label_occlusion_tolerance'),
            description: lc('label_occlusion_tolerance_desc'),
            min: 0,
            max: 1,
            step: 0.01,
            format: hundredths
        },

        section(lc('relief'), 'relief'),
        { type: 'slider', store: peakFinderOutlineWidth, title: lc('outline_width'), min: 0.5, max: 4, step: 0.1, format: (value) => value.toFixed(1), only: 'relief' },
        // 0 is the plain silhouette line; above it, a heavier skyline stroke that many texels wide
        { type: 'slider', store: peakFinderHorizonBoost, title: lc('horizon_boost'), min: 0, max: 6, step: 0.5, format: (value) => value.toFixed(1), only: 'relief' },
        {
            type: 'slider',
            store: peakFinderArOutlineWidth,
            title: lc('ar_outline_width'),
            description: lc('ar_line_default_desc'),
            min: 0,
            max: 4,
            step: 0.1,
            format: (value) => (value === 0 ? lc('same') : value.toFixed(1)),
            only: 'relief'
        },
        {
            type: 'slider',
            store: peakFinderArHorizonBoost,
            title: lc('ar_horizon_boost'),
            description: lc('ar_line_default_desc'),
            min: 0,
            max: 6,
            step: 0.5,
            format: (value) => (value === 0 ? lc('same') : value.toFixed(1)),
            only: 'relief'
        },
        { type: 'slider', store: peakFinderHillshade, title: lc('hillshade_strength'), min: 0, max: 1, step: 0.05, format: hundredths, only: 'relief' },
        { type: 'slider', store: peakFinderExaggeration, title: lc('exageration'), min: 0.5, max: 3, step: 0.05, format: (value) => `${value.toFixed(2)}×`, only: 'relief' },

        section(lc('advanced')),
        {
            type: 'slider',
            store: peakFinderViewDistanceMetres,
            title: lc('viewing_distance'),
            description: lc('viewing_distance_desc'),
            min: 10000,
            max: 400000,
            step: 10000,
            format: formatDistance,
            only: 'relief'
        },
        {
            type: 'slider',
            store: peakFinderRealisticViewDistance,
            title: lc('viewing_distance_realistic'),
            description: lc('viewing_distance_desc'),
            min: 10000,
            max: 200000,
            step: 5000,
            format: formatDistance,
            only: 'realistic'
        },
        {
            type: 'slider',
            store: peakFinderDrapeCacheSize,
            title: lc('panorama_drape_cache'),
            description: lc('panorama_drape_cache_desc'),
            min: 64,
            max: 512,
            step: 32,
            format: (value) => `${value} MB`,
            only: 'realistic'
        },
        {
            type: 'slider',
            store: peakFinderTileLodFactor,
            title: lc('panorama_tile_lod'),
            description: lc('panorama_tile_lod_desc'),
            min: 0.25,
            max: 2,
            step: 0.05,
            format: (value) => value.toFixed(2),
            only: 'realistic'
        },
        {
            type: 'slider',
            store: peakFinderTerrainMaxZoom,
            title: lc('terrain_zoom_cap'),
            description: lc('terrain_zoom_cap_desc'),
            min: 11,
            max: 17,
            step: 1,
            format: (value) => `z${Math.round(value)}`
        },
        { type: 'slider', store: peakFinderMeshResolution, title: lc('mesh_resolution'), description: lc('mesh_resolution_desc'), min: 16, max: 256, step: 16, format: whole },
        // Next to the view distance on purpose: the two multiply into the tile count.
        {
            type: 'slider',
            store: peakFinderTileCoarsening,
            title: lc('tile_coarsening'),
            description: lc('tile_coarsening_desc'),
            min: 0,
            max: 6,
            step: 1,
            format: (value) => (value === 0 ? lc('no_limit') : `-${Math.round(value)}`)
        },
        { type: 'switch', store: peakFinderDetailSource, title: lc('detail_source'), description: lc('detail_source_desc') },
        { type: 'switch', store: peakFinderStaticPeaks, title: lc('static_peaks'), description: lc('static_peaks_desc') },
        { type: 'slider', store: peakFinderPeakZoom, title: lc('peak_search_zoom'), description: lc('peak_search_zoom_desc'), min: 8, max: 14, step: 1, format: whole },
        { type: 'slider', store: peakFinderDetailLevels, title: lc('detail_levels'), description: lc('detail_levels_desc'), min: 0, max: 5, step: 1, format: whole },
        {
            type: 'slider',
            store: peakFinderDetailFeatures,
            title: lc('detail_features'),
            description: lc('detail_features_desc'),
            min: 0,
            max: 4096,
            step: 32,
            format: (value) => (value === 0 ? lc('no_limit') : whole(value))
        },
        { type: 'slider', store: peakFinderLabelPersist, title: lc('label_persist'), description: lc('label_persist_desc'), min: 0, max: 30, step: 1, format: whole },
        {
            type: 'slider',
            store: peakFinderLabelPadding,
            title: lc('label_padding'),
            description: lc('label_padding_desc'),
            min: 0,
            max: 600,
            step: 25,
            format: (value) => (value === 0 ? lc('automatic') : pixels(value))
        },
        {
            type: 'slider',
            store: peakFinderLabelMaxDistance,
            title: lc('label_max_distance'),
            min: 0,
            max: 300000,
            step: 10000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        }
    ];
}
