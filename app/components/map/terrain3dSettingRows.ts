import type { PeakFinderSettingRow as SettingRow } from '~/components/peaks/peakFinderSettingRows';
import { formatDistance } from '~/helpers/formatter';
import { lc } from '~/helpers/locale';
import {
    terrain3dTilt,
    terrainAutoFlattenByTilt,
    terrainCameraClearance,
    terrainDrapeCacheSize,
    terrainDrapeResolution,
    terrainExaggeration,
    terrainFlattenModeFull,
    terrainFog,
    terrainFogVerticalEnd,
    terrainFogVerticalStart,
    terrainLighting,
    terrainMeshResolution,
    terrainNodeResolution,
    terrainShadowCascades,
    terrainShadowCasterMargin,
    terrainShadowDistance,
    terrainShadowMapSize,
    terrainShadowSoftness,
    terrainShadowStrength,
    terrainShadows,
    terrainSky,
    terrainSunAltitude,
    terrainSunAzimuth,
    terrainSwitchDuration,
    terrainTouchMode,
    terrainViewDistanceFactor,
    terrainViewDistanceMax,
    terrainViewDistanceMetres
} from '~/stores/terrainStore';

const touchModes = [
    { value: 'classic', title: lc('touch_mode_classic') },
    { value: 'look', title: lc('touch_mode_look') },
    { value: 'fps', title: lc('touch_mode_fps') }
];

const section = (title: string): SettingRow => ({ type: 'sectionheader', title });
const header = (title: string) => title.toUpperCase();
const degrees = (value: number) => `${Math.round(value)}°`;

/**
 * The 3D terrain mode's settings, ONE list for both places they are shown: the sheet behind its
 * side-bar button (`Terrain3DSettings`) and the app's settings screen (`Settings`, `terrain_3d`), as
 * `peakFinderSettingRows` does for the peak finder. Both bind the same stores.
 *
 * The sun and shadow knobs only mean something with lighting and shadows on: the sheet hides them
 * otherwise, the settings screen lists everything.
 */
export function terrain3dSettingRows(show = { lighting: true, shadows: true }): SettingRow[] {
    return [
        section(header(lc('terrain_3d'))),
        { type: 'slider', store: terrainExaggeration, title: lc('exageration'), min: 0.5, max: 3, step: 0.05, format: (value) => `${value.toFixed(2)}×` },
        { type: 'slider', store: terrainMeshResolution, title: lc('mesh_resolution'), min: 16, max: 256, step: 16, format: (value) => String(Math.round(value)) },
        // Under the mesh, because it is the one that moves the relief: the mesh above only draws it.
        {
            type: 'slider',
            store: terrainNodeResolution,
            title: lc('node_resolution'),
            description: lc('node_resolution_desc'),
            min: 0,
            max: 256,
            step: 16,
            format: (value) => (value <= 0 ? lc('follow_mesh') : String(Math.round(value)))
        },
        {
            type: 'slider',
            store: terrainDrapeResolution,
            title: lc('drape_resolution'),
            description: lc('drape_resolution_desc'),
            // 0 is not a resolution but the AUTOMATIC one, and the SDK clamps anything else to [128, 2048]
            min: 0,
            max: 2048,
            step: 128,
            format: (value) => (value === 0 ? lc('auto') : `${Math.round(value)} px`)
        },
        {
            type: 'slider',
            store: terrainDrapeCacheSize,
            title: lc('drape_cache_size'),
            description: lc('drape_cache_size_desc'),
            // Right below the resolution, because the two are one setting: the cache has to hold two
            // covers at whatever the resolution costs per tile, or it evicts every frame. Which is why
            // 0 - the default - follows the resolution rather than standing still while it moves.
            min: 0,
            max: 512,
            step: 32,
            format: (value) => (value === 0 ? lc('auto') : `${Math.round(value)} MB`)
        },
        { type: 'slider', store: terrainViewDistanceFactor, title: lc('view_distance_factor'), min: 0.5, max: 6, step: 0.1, format: (value) => `${value.toFixed(1)}×` },
        {
            type: 'slider',
            store: terrainViewDistanceMetres,
            title: lc('viewing_distance'),
            description: lc('viewing_distance_desc'),
            min: 0,
            max: 400000,
            step: 10000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        },
        {
            type: 'slider',
            store: terrainViewDistanceMax,
            title: lc('viewing_distance_max'),
            description: lc('viewing_distance_max_desc'),
            min: 0,
            max: 400000,
            step: 5000,
            format: (value) => (value === 0 ? lc('no_limit') : formatDistance(value))
        },
        { type: 'slider', store: terrainCameraClearance, title: lc('camera_clearance'), min: 0, max: 400, step: 1, format: (value) => `${Math.round(value)} m` },
        { type: 'slider', store: terrainSwitchDuration, title: lc('switch_duration'), min: 0, max: 6, step: 0.1, format: (value) => `${value.toFixed(1)} s` },
        { type: 'slider', store: terrain3dTilt, title: lc('threed_tilt'), min: 5, max: 80, step: 1, format: degrees },

        section(header(lc('behavior'))),
        { type: 'segment', store: terrainTouchMode, title: lc('touch_mode'), description: lc('touch_mode_desc'), options: touchModes },
        { type: 'switch', store: terrainFlattenModeFull, title: lc('threed_flatten_mode_full'), description: lc('threed_flatten_mode_full_desc') },
        { type: 'switch', store: terrainAutoFlattenByTilt, title: lc('auto_3d_by_tilt'), description: lc('auto_3d_by_tilt_desc') },
        { type: 'switch', store: terrainSky, title: lc('sky') },
        { type: 'switch', store: terrainFog, title: lc('fog'), description: lc('terrain_fog_desc') },
        // the altitudes the haze fades out between: what leaves the summits standing above it
        { type: 'slider', store: terrainFogVerticalStart, title: lc('fog_vertical_start'), description: lc('fog_vertical_start_desc'), min: 0, max: 4000, step: 100, format: formatDistance },
        { type: 'slider', store: terrainFogVerticalEnd, title: lc('fog_vertical_end'), description: lc('fog_vertical_end_desc'), min: 0, max: 6000, step: 100, format: formatDistance },

        section(header(lc('lighting'))),
        { type: 'switch', store: terrainLighting, title: lc('terrain_lighting'), description: lc('terrain_lighting_desc') },
        // the sun is only written while the ground is lit, so it is only worth showing there
        ...(show.lighting
            ? ([
                  { type: 'slider', store: terrainSunAzimuth, title: lc('sun_azimuth'), description: lc('sun_azimuth_desc'), min: 0, max: 360, step: 1, format: degrees },
                  { type: 'slider', store: terrainSunAltitude, title: lc('sun_altitude'), description: lc('sun_altitude_desc'), min: 0, max: 90, step: 1, format: degrees }
              ] as SettingRow[])
            : []),
        { type: 'switch', store: terrainShadows, title: lc('shadows'), description: lc('shadows_desc') },
        ...(show.shadows
            ? ([
                  {
                      type: 'slider',
                      store: terrainShadowStrength,
                      title: lc('shadow_strength'),
                      description: lc('shadow_strength_desc'),
                      min: 0,
                      max: 2,
                      step: 0.05,
                      format: (value) => value.toFixed(2)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowDistance,
                      title: lc('shadow_distance'),
                      description: lc('shadow_distance_desc'),
                      min: 0,
                      max: 12,
                      step: 0.5,
                      format: (value) => (value === 0 ? lc('auto') : `${value.toFixed(1)}×`)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowMapSize,
                      title: lc('shadow_map_size'),
                      description: lc('shadow_map_size_desc'),
                      min: 256,
                      max: 4096,
                      step: 256,
                      format: (value) => `${Math.round(value)} px`
                  },
                  {
                      type: 'slider',
                      store: terrainShadowCascades,
                      title: lc('shadow_cascades'),
                      description: lc('shadow_cascades_desc'),
                      min: 1,
                      max: 4,
                      step: 1,
                      format: (value) => String(Math.round(value))
                  },
                  {
                      type: 'slider',
                      store: terrainShadowSoftness,
                      title: lc('shadow_softness'),
                      description: lc('shadow_softness_desc'),
                      min: 0,
                      max: 8,
                      step: 0.5,
                      format: (value) => value.toFixed(1)
                  },
                  {
                      type: 'slider',
                      store: terrainShadowCasterMargin,
                      title: lc('shadow_caster_margin'),
                      description: lc('shadow_caster_margin_desc'),
                      min: 0,
                      max: 8,
                      step: 1,
                      format: (value) => String(Math.round(value))
                  }
              ] as SettingRow[])
            : [])
    ];
}
