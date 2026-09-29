import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import type { SettingsStore } from '~/stores/settingsStore';
import {
    peakFinderArHorizonBoost,
    peakFinderArOutlineWidth,
    peakFinderConstellationArt,
    peakFinderConstellations,
    peakFinderDark,
    peakFinderDetailFeatures,
    peakFinderDetailLevels,
    peakFinderDetailSource,
    peakFinderExaggeration,
    peakFinderFlyElevation,
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
    peakFinderMaxFieldOfView,
    peakFinderMeshResolution,
    peakFinderMoon,
    peakFinderOcclusion,
    peakFinderOutlineWidth,
    peakFinderPeakZoom,
    peakFinderPlanets,
    peakFinderScreenOrientation,
    peakFinderStars,
    peakFinderStarsLabelsOnSummits,
    peakFinderStaticPeaks,
    peakFinderSun,
    peakFinderSunHours,
    peakFinderTerrainMaxZoom,
    peakFinderTileCoarsening,
    peakFinderTilt,
    peakFinderViewDistanceMetres
} from '~/stores/terrainStore';

// One list shared by `PeakFinderSettings` and the `Settings` screen, so rows/ranges/formats cannot drift.
// `suntime` is panorama-only: the moment the sky is drawn for is not a persisted setting.
export interface PeakFinderSettingRow {
    type: 'sectionheader' | 'switch' | 'slider' | 'segment' | 'suntime';
    title: string;
    description?: string;
    store?: SettingsStore<any>;
    min?: number;
    max?: number;
    step?: number;
    format?: (value: number) => string;
    options?: { value: string; title: string }[];
}

const section = (title: string): PeakFinderSettingRow => ({ type: 'sectionheader', title: title.toUpperCase() });
const degrees = (value: number) => `${Math.round(value)}°`;
const hundredths = (value: number) => value.toFixed(2);
const whole = (value: number) => String(Math.round(value));
const pixels = (value: number) => `${Math.round(value)} px`;

export function peakFinderSettingRows(): PeakFinderSettingRow[] {
    return [
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

        section(lc('relief')),
        { type: 'slider', store: peakFinderOutlineWidth, title: lc('outline_width'), min: 0.5, max: 4, step: 0.1, format: (value) => value.toFixed(1) },
        // 0 is the plain silhouette line; above it, a heavier skyline stroke that many texels wide
        { type: 'slider', store: peakFinderHorizonBoost, title: lc('horizon_boost'), min: 0, max: 6, step: 0.5, format: (value) => value.toFixed(1) },
        {
            type: 'slider',
            store: peakFinderArOutlineWidth,
            title: lc('ar_outline_width'),
            description: lc('ar_line_default_desc'),
            min: 0,
            max: 4,
            step: 0.1,
            format: (value) => (value === 0 ? lc('same') : value.toFixed(1))
        },
        {
            type: 'slider',
            store: peakFinderArHorizonBoost,
            title: lc('ar_horizon_boost'),
            description: lc('ar_line_default_desc'),
            min: 0,
            max: 6,
            step: 0.5,
            format: (value) => (value === 0 ? lc('same') : value.toFixed(1))
        },
        { type: 'slider', store: peakFinderHillshade, title: lc('hillshade_strength'), min: 0, max: 1, step: 0.05, format: hundredths },
        { type: 'slider', store: peakFinderExaggeration, title: lc('exageration'), min: 0.5, max: 3, step: 0.05, format: (value) => `${value.toFixed(2)}×` },

        section(lc('advanced')),
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
