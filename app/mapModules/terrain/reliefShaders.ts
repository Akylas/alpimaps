/**
 * The peak finder's look, as shader source.
 *
 * None of this is in the SDK. The SDK provides the two mechanisms — a terrain surface fragment
 * shader with `vec4 surfaceColor()`, and a full-screen `PostProcessEffect` with an offscreen colour
 * buffer plus the packed terrain depth — and the application decides what the map looks like.
 *
 * Started from the SDK demo's shaders (`integrations/nativescript/demo-snippets/svelte/common/
 * shaders.ts`) and then moved towards the render of THIS app's web peak finder (`geo-three/webapp`),
 * which is the picture users already know. The two differ in ways worth writing down, because they
 * are not obvious from either source alone:
 *
 *  1. The web draws NO SHADED SURFACE. `MaterialHeightShader.ts:622` returns a fully transparent
 *     fragment unless `drawTexture` is on, and `app.ts:849` leaves it off for the shipped defaults.
 *     So the web picture is ink on blank paper — `shadows: true` in its settings never shows,
 *     because there is no lit surface for a shadow to fall on. Hence PAPER_SURFACE_SHADER, and
 *     hence `peakFinderLinesOnly` defaulting to true.
 *  2. The web inks BOTH sides of a depth break and lifts weak differences with a fractional
 *     exponent; the demo inks only the nearer side and thresholds weak ones away. Both are in the
 *     outline shader below, chosen by `uSymmetric`.
 *  3. The web reads a full-resolution scene depth buffer. The SDK hands this effect a HALF
 *     resolution terrain depth with nearest filtering, which is why the step is floored at
 *     `uDepthTexelSize`. Distant hairlines are therefore coarser than the web's, and no amount of
 *     parameter tuning changes that — it needs full-res terrain depth from the SDK.
 *
 * What a surface shader may read (redeclaring any of them is a compile error, and a shader that
 * fails to compile is silently dropped):
 *
 *     varying vec3  v_normal;    // unit surface normal, x east, y north, z up
 *     varying vec3  v_worldPos;
 *     varying float v_elevation; // metres, BEFORE exaggeration
 *     varying float v_dist;      // metres from the camera
 *     uniform vec3  u_sunDir;
 *     uniform vec4  u_sunColor;
 *     uniform float u_sunIntensity;
 *     uniform float u_ambientIntensity;
 *     uniform vec4  u_fogColor;
 *     uniform vec2  u_fogRange;
 *     uniform float u_time;
 *     uniform float u_zoom;
 *     uniform vec2  u_resolution;
 *     float fogAmount(float dist);
 *
 * plus every uniform named by setSurfaceParameter / setSurfaceColorParameter.
 */

/**
 * Palette of the whole relief view. The summit names, their plate, the surface, the ink lines and the
 * sky all read from these, so one switch changes the lot.
 */
export const RELIEF_PALETTE = {
    light: { ink: '#14141a', paper: '#f7f7f4', shade: '#6c7280', sky: '#9fc6e8' },
    dark: { ink: '#e8ecf5', paper: '#10131a', shade: '#5a6070', sky: '#070a12' }
};

export type ReliefPalette = (typeof RELIEF_PALETTE)['light'];

export function reliefPalette(dark: boolean): ReliefPalette {
    return dark ? RELIEF_PALETTE.dark : RELIEF_PALETTE.light;
}

/** Surface knobs with no setting of their own — the look, not a taste. */
export const RELIEF_DEFAULTS = {
    ambient: 0.35,
    hazeDistance: 60000,
    /** Silhouette sensitivity of the demo's asymmetric path. */
    depthThreshold: 1,
    /** The depth texture is half resolution, so a narrower step samples the same texel twice. */
    depthTexelSize: 2,
    /** How far the silhouette test is relaxed where the surface is seen edge-on. */
    grazingFloor: 0.15
};

/**
 * The web peak finder's surface: none at all.
 *
 * Flat paper rather than a transparent fragment, because in this SDK the terrain surface is what the
 * sky is seen against — returning alpha 0 shows the sky THROUGH the mountains. The fog is still
 * mixed in, so the aerial perspective that makes a panorama read as receding ridges survives.
 * Uniforms: uPaperColor.
 */
export const PAPER_SURFACE_SHADER = `
uniform vec4 uPaperColor;
vec4 surfaceColor() {
    return vec4(mix(uPaperColor.rgb, u_fogColor.rgb, fogAmount(v_dist)), 1.0);
}`;

/**
 * The demo's shaded relief: Lambert shading between a paper and a shade colour, the distance pulling
 * everything back towards the paper, and the resolved fog on top — so a panorama reads as a stack of
 * ever paler ridges. The nicer picture in some light, which is why it is kept beside the web look.
 * Uniforms: uPaperColor, uShadeColor, uShadeStrength, uAmbient, uHaze, uHazeDistance.
 */
export const RELIEF_SURFACE_SHADER = `
uniform vec4 uPaperColor;
uniform vec4 uShadeColor;
uniform float uShadeStrength;
uniform float uAmbient;
uniform float uHaze;
uniform float uHazeDistance;
vec4 surfaceColor() {
    vec3 n = normalize(v_normal);
    float lambert = max(dot(n, normalize(u_sunDir)), 0.0);
    float light = mix(uAmbient, 1.0, lambert);
    vec3 color = mix(uShadeColor.rgb, uPaperColor.rgb, clamp(1.0 - uShadeStrength * (1.0 - light), 0.0, 1.0));
    color = mix(color, uPaperColor.rgb, clamp(v_dist / max(uHazeDistance, 1.0), 0.0, 1.0) * uHaze);
    color = mix(color, u_fogColor.rgb, fogAmount(v_dist));
    return vec4(color, 1.0);
}`;

/**
 * The ridge lines: silhouettes and creases reconstructed from the packed terrain depth the renderer
 * hands the effect. Without this the surface is a flat wash — this is the whole picture in lines-only
 * mode. Needs `terrainDepthRequired = true`.
 *
 * Carries BOTH depth models, because the app's own web version and the SDK demo disagree:
 *
 *   uSymmetric = 1  the web's. Sum of |Δdepth| over the four neighbours, scaled by uDepthGain and
 *                   then raised to uDepthBias — an exponent BELOW 1, which lifts weak differences
 *                   hard and is what keeps far ridges drawing continuous hairlines. Ink lands on
 *                   both sides of a break, giving the soft double line the web has.
 *   uSymmetric = 0  the demo's. Only a neighbour FURTHER away counts, so the line belongs to the
 *                   nearer side of a break, and a relative smoothstep threshold drops weak
 *                   differences. Crisper, and it needs uDistanceFade below 1 to keep the horizon
 *                   the boldest line.
 *
 * Uniforms: uIntensity, uOutlineWidth, uHorizonBoost, uDepthThreshold, uCreaseStrength,
 * uDepthTexelSize, uGrazingFloor, uDistanceFade, uHaze, uSymmetric, uDepthGain, uDepthBias,
 * uInkColor, uPaperColor.
 */
export const RELIEF_OUTLINE_SHADER = `#version 100
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uColorTex;
uniform sampler2D uTerrainDepthTex;
uniform vec2 uInvScreenSize;
uniform vec2 uProjInvScale;
uniform float uFar;
uniform float uIntensity;
uniform float uOutlineWidth;
uniform float uHorizonBoost;
uniform float uDepthThreshold;
uniform float uCreaseStrength;
uniform float uDepthTexelSize;
uniform float uGrazingFloor;
uniform float uDistanceFade;
uniform float uHaze;
uniform float uSymmetric;
uniform float uDepthGain;
uniform float uDepthBias;
uniform vec4 uInkColor;
uniform vec4 uPaperColor;

float unpackDepth(vec4 c) {
    return dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}

// Eye-space position of a pixel from the packed linear depth.
vec3 eyePos(vec2 uv, float depth) {
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc * uProjInvScale, -1.0) * depth * uFar;
}

void main(void) {
    vec2 uv = gl_FragCoord.xy * uInvScreenSize;
    vec4 color = texture2D(uColorTex, uv);
    vec4 c0 = texture2D(uTerrainDepthTex, uv);
    float d0 = unpackDepth(c0);

    // One width for the terrain-against-terrain lines, everywhere. Widening them with distance
    // instead smears the far ranges into a solid band: up there the ridges are a pixel apart. What
    // is bold in a panorama is the SKY silhouette, and that gets its own, wider test below.
    // Never narrower than uDepthTexelSize screen pixels: the terrain depth runs at half resolution
    // with nearest filtering, so a narrower step samples the same texel twice.
    vec2 delta = uInvScreenSize * max(uOutlineWidth, uDepthTexelSize);
    vec2 skyDelta = uInvScreenSize * max(uOutlineWidth * (1.0 + uHorizonBoost), uDepthTexelSize);
    vec4 cx0 = texture2D(uTerrainDepthTex, uv - vec2(delta.x, 0.0));
    vec4 cx1 = texture2D(uTerrainDepthTex, uv + vec2(delta.x, 0.0));
    vec4 cy0 = texture2D(uTerrainDepthTex, uv - vec2(0.0, delta.y));
    vec4 cy1 = texture2D(uTerrainDepthTex, uv + vec2(0.0, delta.y));
    float dx0 = unpackDepth(cx0);
    float dx1 = unpackDepth(cx1);
    float dy0 = unpackDepth(cy0);
    float dy1 = unpackDepth(cy1);

    // The local surface, from the four neighbours: a surface seen edge-on legitimately changes depth
    // fast from pixel to pixel, and a fold has to be told apart from a merely oblique slope.
    vec3 p0 = eyePos(uv, d0);
    vec3 tx0 = eyePos(uv - vec2(delta.x, 0.0), dx0) - p0;
    vec3 tx1 = eyePos(uv + vec2(delta.x, 0.0), dx1) - p0;
    vec3 ty0 = eyePos(uv - vec2(0.0, delta.y), dy0) - p0;
    vec3 ty1 = eyePos(uv + vec2(0.0, delta.y), dy1) - p0;
    // Two samples on the same depth texel give a zero tangent, and normalizing that is undefined -
    // it painted the whole near field grey.
    float minLength = 1.0e-4 * d0 * uFar;
    bool tangentsValid = length(tx1) > minLength && length(ty1) > minLength;
    float grazing = 1.0;
    if (tangentsValid) {
        vec3 surfaceNormal = normalize(cross(tx1, ty1));
        grazing = abs(dot(normalize(-p0), surfaceNormal));
    }

    // How much of a line this pixel is on, by whichever of the two models is selected.
    float edge;
    // Coverage of the four neighbours: outside the terrain there is no depth to difference against,
    // and reading the far plane as a depth break rings the whole silhouette twice.
    float cover = min(min(cx0.a, cx1.a), min(cy0.a, cy1.a)) * c0.a;
    if (uSymmetric > 0.5) {
        // The web's: symmetric, gain, then a gamma BELOW 1 that lifts the weak differences.
        float diff = abs(d0 - dx0) + abs(d0 - dx1) + abs(d0 - dy0) + abs(d0 - dy1);
        edge = clamp(pow(clamp(diff * uDepthGain, 0.0, 1.0), uDepthBias), 0.0, 1.0) * cover;
    } else {
        // The demo's: only a neighbour FURTHER away counts, so the line belongs to the nearer side of
        // a break. The threshold is relative to the depth, or the far half of the view draws no line
        // at all - and it is relaxed where the surface is seen EDGE-ON, because there the depth runs
        // away between neighbouring pixels without anything being in front of anything.
        float behind = max(max(dx0 - d0, dx1 - d0), max(dy0 - d0, dy1 - d0));
        float threshold = uDepthThreshold * (0.0008 + 0.02 * d0) / max(grazing, uGrazingFloor);
        edge = smoothstep(threshold, threshold * 2.0, behind);
    }
    // Terrain-against-terrain lines fade with distance so the horizon is the boldest line. At 1 this
    // is the web, which does not fade them.
    edge *= mix(1.0, uDistanceFade, d0);
    // ...and terrain against the sky always is one (coverage, not depth: a sky pixel is at the far
    // plane, which a relative threshold would forgive and a difference would saturate).
    float skyNeighbour = 1.0 - min(
        min(texture2D(uTerrainDepthTex, uv - vec2(skyDelta.x, 0.0)).a, texture2D(uTerrainDepthTex, uv + vec2(skyDelta.x, 0.0)).a),
        min(texture2D(uTerrainDepthTex, uv - vec2(0.0, skyDelta.y)).a, texture2D(uTerrainDepthTex, uv + vec2(0.0, skyDelta.y)).a));
    edge = max(edge, skyNeighbour * c0.a);

    // Ridges and valleys: the two tangent directions away from this pixel point straight apart on a
    // flat surface (dot -1) and fold together over a crest. Done on eye positions rather than on
    // depth, so a merely oblique slope does not read as a fold. Off at 0, which is the web.
    if (uCreaseStrength > 0.0 && cover > 0.0) {
        float fold = 0.0;
        if (length(tx0) > minLength && length(tx1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(tx0), normalize(tx1)));
        }
        if (length(ty0) > minLength && length(ty1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(ty0), normalize(ty1)));
        }
        edge = max(edge, smoothstep(0.05, 0.4, fold) * uCreaseStrength * grazing * mix(1.0, uDistanceFade, d0));
    }

    // Aerial perspective: the surface fades into the paper with distance, so the far ranges read as
    // pale outlines and the near ground keeps what shading it has.
    vec3 shaded = mix(color.rgb, uPaperColor.rgb, uHaze * d0 * c0.a);
    vec3 stylized = mix(shaded, uInkColor.rgb, edge * uInkColor.a);

    gl_FragColor = vec4(mix(color.rgb, stylized, uIntensity), 1.0);
}`;
