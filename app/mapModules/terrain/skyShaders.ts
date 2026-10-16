/**
 * The panorama's sky: the SDK's own scattering plus a sun-lit cloud deck by day. Stars are NOT drawn here:
 * the wrapper adds them after `skyColor` from `FogOptions.starIntensity`, which the panorama sets to 0
 * when its own star layer is on. Contract and helper names: SDK docs/features/sky-sun-shadows.md.
 */
export const PANORAMA_SKY_SHADER = [
    'float hash21(vec2 point) {',
    '  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    'float valueNoise(vec2 point) {',
    '  vec2 cell = floor(point), blend = fract(point);',
    '  blend = blend * blend * (3.0 - 2.0 * blend);',
    '  return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), blend.x),',
    '             mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0, 1.0)), blend.x), blend.y);',
    '}',
    // a flat deck the ray is projected onto; the octaves are rotated against each other or the grid shows
    'float clouds(vec3 dir) {',
    '  if (dir.z <= 0.02) return 0.0;',
    '  vec2 point = dir.xy / dir.z * 1.7 + vec2(u_time * 0.004, 0.0);',
    '  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);',
    '  float density = 0.50 * valueNoise(point);',
    '  point = rot * point * 2.1; density += 0.25 * valueNoise(point);',
    '  point = rot * point * 2.3; density += 0.15 * valueNoise(point);',
    '  point = rot * point * 2.7; density += 0.10 * valueNoise(point);',
    '  return smoothstep(0.46, 0.74, density) * smoothstep(0.02, 0.25, dir.z);',
    '}',
    'vec4 skyColor(vec3 rayDir) {',
    // below the horizon only a gap shows (the terrain ends at the view distance, or a tile is not there yet):
    // carry the horizon's colour down into it instead of the flat ground colour, which showed as a band
    '  if (rayDir.z < 0.001) rayDir = normalize(vec3(rayDir.xy, 0.001));',
    '  float elevation = asin(clamp(rayDir.z, -1.0, 1.0));',
    '  vec3 scattered = atmosphere(rayDir, u_sunDir) * (8.0 / u_atmosphere.y);',
    '  vec3 col = tonemap(scattered) / tonemap(vec3(11.2));',
    '  col = atmosphereTint(col, elevation);',
    '  float day = clamp(u_sunDir.z * 4.0 + 0.15, 0.0, 1.0);',
    // no cloud at night: grey blotches over a dark sky read as a bright one
    '  float cover = clouds(rayDir) * day;',
    '  vec3 lit = mix(vec3(0.55, 0.58, 0.66), u_sunColor.rgb * 1.05, day);',
    '  col = mix(col, lit, cover * (0.30 + 0.55 * day));',
    '  return sunDisc(vec4(col, 1.0), rayDir);',
    '}'
].join('\n');
