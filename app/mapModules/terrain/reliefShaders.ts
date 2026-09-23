import { isEInk } from '~/helpers/theme';

/**
 * The peak finder's look, as shader source.
 *
 * None of this is in the SDK. The SDK provides the two mechanisms — a terrain surface fragment
 * shader with `vec4 surfaceColor()`, and a full-screen `PostProcessEffect` with an offscreen colour
 * buffer plus the packed terrain depth — and the application decides what the map looks like.
 *
 * Ported VERBATIM from the android demo (`scripts/android-dev/.../demo/DemoStyles.java`,
 * `reliefSurfaceShader` / `reliefOutlineShader`) — the peak finder is meant to look exactly like it.
 * Two places where that source differs from the plugin's `demo-snippets` copy, which is a revision
 * behind and was what this file started from:
 *
 *  - the surface shader does NOT apply fog. The SDK applies the frame's own fog to whatever
 *    `surfaceColor()` returns, so the snippet's extra `mix(color, u_fogColor, fogAmount(v_dist))`
 *    applied it twice and washed the near ground out.
 *  - there is no symmetric / gamma-lifted depth path. The silhouette test is one-sided on purpose:
 *    testing the absolute difference draws every ridge TWICE, once on each side, which merges into a
 *    smear at the horizon.
 *
 * The one thing no parameter can change: this effect reads a HALF resolution terrain depth with
 * nearest filtering (`TerrainRenderer::BUFFER_DOWNSCALE`), which is why the sampling step below is
 * floored at `uDepthTexelSize`.
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
    /**
     * `shade` IS `ink`, on purpose, and that is what makes the picture match the reference.
     *
     * peakfinder.com's whole panorama is ONE greyscale number: `color = colors.x + (1 - value) *
     * colors.y`, where `value` is the slope shading, the ridge lines and the silhouettes ADDED
     * together. Slope and ridge are the same substance in different amounts, so their ratio is a
     * single thing you can tune.
     *
     * Ours had two axes - the surface mixed paper towards a mid slate (#6c7280) for the shading, and
     * the ink pass mixed that towards near-black for the lines. Moving the slope and ridge sliders
     * then changed the HUE balance as much as the amount, which is why no combination of them ever
     * looked like the reference: pale slate slopes under black lines is not the same picture as pale
     * grey slopes under black lines, however the strengths are set.
     */
    light: { ink: '#14141a', paper: '#f7f7f4', shade: '#14141a', sky: '#9fc6e8', labelSecondary: '#6b7280' },
    dark: { ink: '#e8ecf5', paper: '#10131a', shade: '#e8ecf5', sky: '#070a12', labelSecondary: '#9aa3b2' },
    /**
     * E-ink, where the light palette reads as a grey wash.
     *
     * `shade` is the one that matters: the surface shader mixes the ground from `paper` towards it by
     * the Lambert term, so a mid slate (#6c7280) puts most of the ground in the mid tones — which a
     * screen with sixteen greys and no backlight renders as dither, and dither over the whole picture
     * is what makes the ridge lines hard to find. A LIGHT grey keeps the shading as faint hatching
     * and leaves the reading to the ink, which is also how the geo-three webapp looks: a pale ground
     * with black lines on it, not a grey relief.
     *
     * Paper is pure white and ink pure black for the same reason — anything else is a grey to dither.
     */
    eink: { ink: '#000000', paper: '#ffffff', shade: '#c0c0c0', sky: '#ffffff', labelSecondary: '#000000' },
    /**
     * E-ink at night, which is the same picture with the two ends swapped.
     *
     * Not `dark`: that palette is built out of mid tones (#10131a paper, #5a6070 shade) and mid tones
     * are what an e-ink screen dithers. Pure white ink on pure black, and a shade DARK enough to stay
     * on the black side of the paper — the inverse of the `eink` reasoning above, for the same reason.
     */
    einkDark: { ink: '#ffffff', paper: '#000000', shade: '#404040', sky: '#000000', labelSecondary: '#ffffff' }
};

export type ReliefPalette = (typeof RELIEF_PALETTE)['light'];

/**
 * E-ink takes its own PAIR of palettes: the switch still switches, but between two two-tone looks
 * rather than between the mid-tone ones, which that screen can only dither.
 *
 * It used to return `eink` whatever the switch said, which is why the dark switch did nothing at all
 * on the devices this mode is mostly used on.
 */
export function reliefPalette(dark: boolean): ReliefPalette {
    if (isEInk) {
        return dark ? RELIEF_PALETTE.einkDark : RELIEF_PALETTE.eink;
    }
    return dark ? RELIEF_PALETTE.dark : RELIEF_PALETTE.light;
}

/**
 * Knobs with no setting of their own, straight from `DemoConfig`: the look, not a taste.
 *
 * `uIntensity` is the demo's constant 1.0, and `depthTexelSize` / `grazingFloor` describe the depth
 * buffer rather than the style, so none of the three belong in the settings sheet.
 */
export const RELIEF_DEFAULTS = {
    /**
     * Metres per internal unit: `Const::EARTH_CIRCUMFERENCE / Const::WORLD_SIZE`, 40075016.68558 over
     * 1 << 20. The outline effect's `uFar` is in internal units and its distance fades are in metres,
     * so it needs this to get between them. The surface shader is handed the same number by the SDK
     * as `u_metersPerUnit`; a PostProcessEffect gets only what the app sets.
     */
    metersPerUnit: 40075016.68558 / (1 << 20),
    /** RELIEF_AMBIENT: light left on a slope facing away from the sun. */
    ambient: 0.35,
    /** RELIEF_HAZE_DISTANCE, metres. */
    hazeDistance: 60000,
    /** RELIEF_DEPTH_THRESHOLD: silhouette sensitivity. */
    depthThreshold: 1,
    /** The depth texture is half resolution, so a narrower step samples the same texel twice. */
    depthTexelSize: 2,
    /** How far the silhouette test is relaxed where the surface is seen edge-on. */
    grazingFloor: 0.15
};

/**
 * The shaded relief the ink lines are drawn over: Lambert shading between a paper and a shade colour,
 * with the distance pulling everything back towards the paper — so a panorama reads as a stack of ever
 * paler ridges.
 *
 * Plus a SUN-INDEPENDENT slope term, which is peakfinder.com's and is most of why their panorama has
 * relief in it where ours has a flat wash. Theirs is `length(normal.xz) * P1.z` added straight into
 * the darkness (`pp_t_*_frg` in their wasm, where y is up); `length(n.xy)` is the same quantity here,
 * the sine of the slope angle, because `v_normal` is unit with z up. It reads as hillshading without
 * being one: a slope is dark because it is steep, not because it faces away from anything, so it does
 * not vanish on the shadow side and does not move when the sun does.
 *
 * Lambert stays on top of it — that is their model too (ambient + `-dot(sunDir, n)` + a cast-shadow
 * term we have no raster for). The two are ADDED before the clamp rather than multiplied, so the
 * slope term still reads on ground the sun has already darkened.
 *
 * No fog term: the SDK applies the frame's own fog to whatever this returns.
 * Uniforms: uPaperColor, uShadeColor, uShadeStrength, uSlopeShade, uAmbient, uHaze, uHazeDistance.
 */
export const RELIEF_SURFACE_SHADER = `
uniform vec4 uPaperColor;
uniform vec4 uShadeColor;
uniform float uShadeStrength;
uniform float uSlopeShade;
uniform float uAmbient;
uniform float uHaze;
uniform float uHazeDistance;
uniform float uDebugView;
// Set by TerrainRenderer::renderTiles, per tile, from the MESH: (gridSize, attribsRefined, demZoom).
uniform vec4 u_tileDebug;
vec4 surfaceColor() {
    // DEBUG 9 and 10: WHAT EACH TILE ACTUALLY IS, painted on it.
    //
    // Which per-tile property makes one tile lighter than the one beside it has been inferred four
    // times - mesh density, sample distance, DEM stretch, prefetch order - and each inference cost a
    // rebuild to disprove. These two views read the answer off the picture instead: whatever the
    // light tiles have in common is visible in one screenshot.
    //
    //   9:  MESH DENSITY. red 4 | orange 16 | yellow 32 | green 48 | cyan 64 | blue 96.
    //   10: NORMAL SOURCE and DEM zoom. RED tile = still on the cheap mesh-gradient stand-in,
    //       GREEN = DEM-refined normals; brightness rises with the DEM zoom it resolved (z4..z12).
    if (uDebugView > 8.5 && uDebugView < 9.5) {
        float cells = u_tileDebug.x;
        if (cells < 8.0) { return vec4(1.0, 0.0, 0.0, 1.0); }
        if (cells < 24.0) { return vec4(1.0, 0.5, 0.0, 1.0); }
        if (cells < 40.0) { return vec4(1.0, 1.0, 0.0, 1.0); }
        if (cells < 56.0) { return vec4(0.0, 0.8, 0.0, 1.0); }
        if (cells < 80.0) { return vec4(0.0, 0.8, 1.0, 1.0); }
        return vec4(0.0, 0.0, 1.0, 1.0);
    }
    // 13: ARE THIS TILE'S NORMALS STALE? Attribs are baked once and never recomputed, so a tile
    //     refined while standing on a coarse ancestor keeps those normals after its own grid lands -
    //     and views 9 and 10 both report it as healthy, because gridSize, refined and demZoom are all
    //     correct. Only the stored VALUES are old, and which tiles lose the race changes every run.
    //       GREEN  normals computed from the DEM zoom this tile has now
    //       YELLOW one level stale | ORANGE two | RED three or more
    //       BLACK  never refined
    // 13: TILE BOUNDARIES, over the real shading. Every per-tile property measured so far - gridSize,
    //     refined, demZoom, staleness - has come back uniform while regions still differ, so this
    //     tests the assumption under all of them: that the differing regions ARE tiles. Alternate
    //     tiles are darkened slightly, leaving the shading readable underneath. If the pale patches
    //     line up with the checker, they are tiles and something per-tile is still unmeasured; if
    //     they cut across it, they were never tiles and the whole per-tile search was misdirected.

    if (uDebugView > 9.5 && uDebugView < 10.5) {
        // DEM ZOOM AS BANDS, not as brightness. Encoded as brightness this read as "all green" even
        // where the shading plainly differed - a range of zooms is invisible against a colour ramp,
        // and an instrument that cannot be read is worse than none. One hue per zoom instead.
        //   z<=5 red | 6 orange | 7 yellow | 8 green | 9 cyan | 10 blue | 11 magenta | 12+ white
        // A tile with no grid at all (demZoom -1) is BLACK.
        float demZoom = u_tileDebug.z;
        if (demZoom < 0.0) { return vec4(0.0, 0.0, 0.0, 1.0); }
        if (demZoom < 5.5) { return vec4(1.0, 0.0, 0.0, 1.0); }
        if (demZoom < 6.5) { return vec4(1.0, 0.5, 0.0, 1.0); }
        if (demZoom < 7.5) { return vec4(1.0, 1.0, 0.0, 1.0); }
        if (demZoom < 8.5) { return vec4(0.0, 0.8, 0.0, 1.0); }
        if (demZoom < 9.5) { return vec4(0.0, 0.8, 1.0, 1.0); }
        if (demZoom < 10.5) { return vec4(0.0, 0.2, 1.0, 1.0); }
        if (demZoom < 11.5) { return vec4(1.0, 0.0, 1.0, 1.0); }
        return vec4(1.0, 1.0, 1.0, 1.0);
    }
    // DEBUG 7: the slope this shader sees, straight off v_normal - the SAME per-vertex attribute
    // the normal-packing depth pass reads. Compared against debug 1, which reads the PACKED buffer,
    // it says which side of that pass is at fault: both black means the mesh attribute itself is
    // flat, only the packed one black means the packing pass is losing it.
    // Bounded above as well: view 8 is a post-process view, and the surface must draw normally
    // under it or there is nothing for the post-process to classify.
    if (uDebugView > 6.5 && uDebugView < 7.5) {
        float debugSlope = length(normalize(v_normal).xy);
        return vec4(debugSlope, debugSlope, debugSlope, 1.0);
    }
    vec3 n = normalize(v_normal);
    // THE SUN TERM, BOUNDED AT BOTH ENDS - peakfinder.com's 'max(-0.2, -dot(sunDir, n)) * P2.w'.
    //
    // A plain Lambert makes the picture depend on which way you are LOOKING, because which way you
    // look decides which aspects you see. 'max(dot(n, sun), 0)' saturates at both ends: a face square
    // to the sun goes to pure paper and loses all its relief, and every face turned even slightly
    // away is equally dark, so the shadow side has no gradation either. Turn on the spot and a range
    // facing the sun is a white blank while the one behind you is full of detail - which is exactly
    // the "in one direction we see it, in the other it is very light" report.
    //
    // Theirs clamps the LIT side at -0.2 instead of 0, so a sunward face still keeps most of its
    // shading, and it does NOT clamp the shadow side at zero, so that side keeps grading all the way
    // to fully-opposite. The relief then reads the same whichever way the camera points.
    float sunDarkness = max(-0.2, -dot(n, normalize(u_sunDir)));
    float darkness = clamp(uShadeStrength * (uAmbient + sunDarkness) + uSlopeShade * length(n.xy), 0.0, 1.0);
    vec3 color = mix(uPaperColor.rgb, uShadeColor.rgb, darkness);
    color = mix(color, uPaperColor.rgb, clamp(v_dist / max(uHazeDistance, 1.0), 0.0, 1.0) * uHaze);
    // 13: TILE BOUNDARIES OVER THE REAL SHADING. Applied at the end, not as an early return, so the
    // picture is the actual one with a checker laid over it. Every per-tile property measured so far
    // - gridSize, refined, demZoom, staleness - is uniform while regions still differ, so this tests
    // the assumption underneath all of them: that the differing regions ARE tiles. If the pale
    // patches line up with the checker they are tiles and something per-tile is still unmeasured; if
    // they cut across it, they never were, and the per-tile search was misdirected from the start.
    if (uDebugView > 12.5 && uDebugView < 13.5 && u_tileDebug.w > 0.5) {
        color *= 0.75;
    }
    return vec4(color, 1.0);
}`;

/**
 * The ridge lines: silhouettes and interior folds taken off the packed terrain buffer the renderer
 * hands the effect. Without this the shaded surface is a grey wash, which is what makes it look like
 * the mode did not come on at all. Needs `terrainDepthRequired = true`.
 *
 * Two variants, because the SDK will hand over two different buffers:
 *
 * **`normals: false`** — the one that has always been here. RGB is 24-bit linear depth and A is
 * coverage, and the interior fold is RECONSTRUCTED: tangents from the four depth neighbours, a fold
 * where they point together. Its problem is written all over `peakFinderCreaseThreshold` — a tile
 * edge where two mesh levels meet is a genuine kink in the surface, so the test cannot tell a crest
 * from a seam and the whole term ends up turned off (`peakFinderCreaseStrength` defaults to 0).
 *
 * **`normals: true`** — the buffer `PostProcessEffect.terrainNormalsRequired` asks for: 16-bit sqrt
 * depth in RG, the mesh's own surface normal in BA. The interior term is then the screen-space
 * gradient of that NORMAL, which is peakfinder.com's (`length(vec2(|d n.x|, |d n.z|)) * P1.x` in
 * their panorama fragment shader). It draws every ridge and gully the DEM has, at any distance, and
 * it does not draw seams: the normal is per-vertex data, not something guessed back out of a
 * half-resolution depth, so a LOD change is not a fold in it.
 *
 * Everything else — the one-sided silhouette, the sky test, the haze, the AR compositing, the lens
 * warp — is shared, and the depth the shared code sees is linear either way.
 *
 * There is no depth-gradient slope term any more. That was geo-three's `CustomOutlineEffect`, and
 * the reference has nothing like it: peakfinder.com's one slope term is `length(normal.xz)`, the
 * surface's own tilt, which `RELIEF_SURFACE_SHADER` already draws as `uSlopeShade * length(n.xy)`.
 * Measuring slope from DEPTH instead is what greyed out the far half of the view — a pixel covers
 * more ground the further it is, so the term saturated everywhere past the middle distance.
 *
 * Uniforms: uIntensity, uOutlineWidth, uHorizonBoost, uDepthThreshold, uCreaseStrength,
 * uCreaseThreshold, uRidgeStrength, uRidgeThreshold, uDepthTexelSize, uGrazingFloor, uInkDistance,
 * uInkShadeCap, uMetersPerUnit, uHazeDistance,
 * uHaze, uInkColor, uPaperColor.
 */
export function reliefOutlineShader(normals: boolean) {
    return `#version 100
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
uniform float uCreaseThreshold;
uniform float uRidgeStrength;
uniform float uRidgeThreshold;
uniform float uRidgeGroundSpan;
uniform float uTransparent;
uniform float uDepthTexelSize;
uniform float uGrazingFloor;
uniform float uInkDistance;
uniform float uInkShadeCap;
uniform float uDebugView;
uniform float uMetersPerUnit;
uniform float uSilhouetteGate;
uniform float uHazeDistance;
uniform float uHaze;
uniform vec4 uInkColor;
uniform vec4 uPaperColor;
// Lens distortion, for AR. k1..k3 radial and p1, p2 tangential, exactly as Camera2's LENS_DISTORTION
// states them; uDistortCenter* is the principal point's offset in the same tangent units. Every
// coefficient zero - the default, and every non-AR frame - makes distortUv the identity.
// Scalars and not vectors because PostProcessEffect carries float and colour uniforms only.
uniform float uDistortK1;
uniform float uDistortK2;
uniform float uDistortK3;
uniform float uDistortP1;
uniform float uDistortP2;
uniform float uDistortCenterX;
uniform float uDistortCenterY;
// Half-field TANGENTS: what the camera frame spans on SCREEN, and what this frame was RENDERED to
// span. The render is the wider of the two, by exactly enough that undistorting the screen's corners
// still lands inside it - see arGeometry in features/peakFinder.ts. Equal when there is no warp.
uniform float uDistortScreenTanX;
uniform float uDistortScreenTanY;
uniform float uDistortRenderTanX;
uniform float uDistortRenderTanY;
// 1 when the view is a quarter turn from the camera's own landscape frame, which is what a portrait
// AR view is. The COORDINATES are rotated rather than the coefficients: that way k1..k3 and p1, p2
// are used exactly as the platform states them, and only this one mapping carries the orientation.
uniform float uDistortRotate;

${
    normals
        ? `// RG holds the depth SQRT-encoded, so it is squared back into the linear 0..1 everything below
// expects. There is no coverage channel in this layout: the encoded 1.0 is the sky, and the terrain
// pass is clamped just short of it so the test cannot be met by ground.
float unpackDepth(vec4 c) {
    float enc = dot(c.rg, vec2(1.0, 1.0 / 255.0));
    return enc * enc;
}
float unpackCover(vec4 c) {
    return step(dot(c.rg, vec2(1.0, 1.0 / 255.0)), 0.9999);
}
// Octahedral, upper hemisphere: the pass normalises by the L1 norm and keeps x and y, and a height
// field's normal always points up, so z is recovered without a sign to guess.
vec3 unpackNormal(vec4 c) {
    vec2 oct = c.ba * 2.0 - 1.0;
    return normalize(vec3(oct, 1.0 - abs(oct.x) - abs(oct.y)));
}`
        : `float unpackDepth(vec4 c) {
    return dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}
float unpackCover(vec4 c) {
    return c.a;
}
// No normal in this layout. The debug views that ask for one report "flat" rather than failing to
// compile, which is itself the answer: this variant cannot draw normal-based ridges at all.
vec3 unpackNormal(vec4 c) {
    return vec3(0.0, 0.0, 1.0);
}`
}

// Where to sample the RECTILINEAR render for the pixel a distorted camera would put here.
//
// The camera's picture is distorted and the render is not, so for an output pixel the render has to
// be read at the IDEAL position that the lens maps onto it - the inverse of Brown-Conrady. There is
// no closed form, so it is the standard fixed-point iteration: divide out the radial term at the
// current estimate and repeat. Phone-scale distortion converges in two or three rounds.
//
// The render covers a wider field than the screen, which is what makes this possible at all: barrel
// distortion pulls the periphery inwards, so the ideal position for a screen CORNER lies outside the
// screen's own field, and a render that stopped at the screen's field would have nothing there to
// read but its own edge.
vec2 distortUv(vec2 uv) {
    if (abs(uDistortK1) + abs(uDistortK2) + abs(uDistortK3) + abs(uDistortP1) + abs(uDistortP2) == 0.0) {
        return uv;
    }
    vec2 center = vec2(uDistortCenterX, uDistortCenterY);
    // Screen NDC into the tangent space the coefficients are stated in, about the principal point.
    vec2 viewTan = (uv * 2.0 - 1.0) * vec2(uDistortScreenTanX, uDistortScreenTanY);
    vec2 distorted = (uDistortRotate > 0.5 ? vec2(viewTan.y, -viewTan.x) : viewTan) - center;
    vec2 ideal = distorted;
    for (int i = 0; i < 3; i++) {
        float r2 = dot(ideal, ideal);
        float radial = 1.0 + r2 * (uDistortK1 + r2 * (uDistortK2 + r2 * uDistortK3));
        vec2 tangential = vec2(2.0 * uDistortP1 * ideal.x * ideal.y + uDistortP2 * (r2 + 2.0 * ideal.x * ideal.x),
                               uDistortP1 * (r2 + 2.0 * ideal.y * ideal.y) + 2.0 * uDistortP2 * ideal.x * ideal.y);
        ideal = (distorted - tangential) / max(radial, 0.1);
    }
    // ...back into the view's frame, and out through the RENDER's field, which is the wider one.
    vec2 idealView = ideal + center;
    idealView = uDistortRotate > 0.5 ? vec2(-idealView.y, idealView.x) : idealView;
    return (idealView / vec2(uDistortRenderTanX, uDistortRenderTanY)) * 0.5 + 0.5;
}

// Eye-space position of a pixel from the packed linear depth.
vec3 eyePos(vec2 uv, float depth) {
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc * uProjInvScale, -1.0) * depth * uFar;
}

void main(void) {
    // The ONE place the lens warp is applied. Everything below reads the scene, the terrain depth,
    // the edge neighbours and the eye positions through this coordinate, so the whole picture -
    // terrain, ridge lines and summit labels alike - is resampled together and stays registered.
    vec2 uv = distortUv(gl_FragCoord.xy * uInvScreenSize);
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

    // Silhouette: the line belongs to the NEARER side of a depth break, so only a neighbour FURTHER
    // away counts. Testing the absolute difference draws the same ridge twice, once on each side,
    // which at the horizon merges into a smear. The threshold is relative to the depth, or the far
    // half of the view draws no line at all - and it is relaxed where the surface is seen EDGE-ON,
    // because there the depth runs away between neighbouring pixels without anything being in front
    // of anything: flat ground at its own horizon drew a solid black band.
    // peakfinder.com's silhouette, which is a DEPTH GRADIENT and not a one-sided depth test:
    //
    //     gradD = vec2(right.w - left.w, down.w - up.w);
    //     dLen  = length(gradD);
    //     value += smoothstep(0.005, 0.020, dLen) * dLen * P1.w;
    //
    // A central difference in both axes, gated by a FIXED threshold and then scaled by its own
    // magnitude. Three things it does not do, all of which ours did:
    //
    //  - it is not ONE-SIDED. Ours only counted a neighbour further away, on the argument that a
    //    symmetric test draws each ridge twice. It does - but the second stroke lands on the far
    //    side of the same crest, a pixel away, and reads as the line having weight. Theirs is how
    //    the reference gets an even stroke on both flanks instead of a hard edge and a blank.
    //  - it is not divided by GRAZING. Ours relaxed the threshold on edge-on surfaces by up to 6.7x
    //    (uGrazingFloor 0.15), which is why flat far ground and the ground right under the camera
    //    broke into speckle: at a grazing angle the depth runs away between neighbouring pixels with
    //    nothing in front of anything, and dividing the threshold down made that MORE likely to ink.
    //  - its gate is a constant, not a fraction of the depth, so what counts as a silhouette does
    //    not change with where the camera happens to be looking.
    //
    // The gate is in metres here for the same reason uInkDistance is: their normalised depth is over
    // a FIXED far plane (~173 km), so their 0.005 and 0.020 are ~865 m and ~3460 m of depth change
    // across one tap. Ours moves, so the equivalent has to be absolute.
    vec2 gradD = vec2(dx1 - dx0, dy1 - dy0);
    float dLenM = length(gradD) * uFar * uMetersPerUnit;
    float silhouetteTop = uSilhouetteGate * 4.0;
    float edge = smoothstep(uSilhouetteGate, silhouetteTop, dLenM) * clamp(dLenM / max(silhouetteTop, 1.0), 0.0, 1.0) * uDepthThreshold;

    float cover = min(min(unpackCover(cx0), unpackCover(cx1)), min(unpackCover(cy0), unpackCover(cy1))) * unpackCover(c0);
    // Carried out of the ridge block for debug views 11 and 12. The symptom is SCREEN-POSITION
    // dependent ("shaded as they enter screen, loses it in the centre"), which no per-tile property
    // can produce - views 9 and 10 confirmed the whole terrain pipeline is uniform. So the two
    // quantities that vary across the frame get shown directly instead of reasoned about.
    float debugTurn = 0.0;
    float debugRidgeScale = 0.0;
    float debugStepMetres = 0.0;
${
    normals
        ? `    // RIDGES, off the normal the pass handed us rather than reconstructed: how fast the surface
    // direction turns across a pixel. peakfinder.com's interior line, near enough verbatim - they
    // take the screen-space central difference of two normal components and its length is the ink.
    //
    // Why this and not the fold test below: the fold test asks whether the SURFACE bends, and a tile
    // edge between two mesh levels genuinely does bend, so it cannot answer without inking seams.
    // The normal is per-vertex data interpolated across the triangle, so an LOD change moves it by
    // whatever the two levels disagree about the ground - a hair - while a crest turns it through
    // tens of degrees. Same picture, different question.
    //
    // Both horizontal components, not the full normal: a height field's z is fixed by the other two,
    // so including it only counts the same turn twice, and unevenly.
    if (uRidgeStrength > 0.0 && cover > 0.0) {
        // THE TAP SPACING IS IN GROUND METRES, NOT IN PIXELS.
        //
        // A fixed screen-space offset measures the turn over whatever ground that pixel happens to
        // cover, and in a panorama that runs from a few metres underfoot to hundreds of metres at the
        // horizon. The SAME crest therefore turns the normal by a hair when it is near and through
        // tens of degrees when it is far, so the ink became a function of DISTANCE rather than of how
        // sharp the ridge is - the far ranges inked solid while the near ground came out blank white,
        // with uRidgeThreshold cutting the near case to exactly zero.
        //
        // This is the one part of peakfinder.com's pass that was ported as a constant and should not
        // have been: their five taps are at v_texcoord1, a VARYING, so the step widens down the
        // screen - which in a panorama is towards the near ground. Same intent, done per pixel here.
        //
        // length(tx1) is the eye-space vector to the neighbour tap, so it already IS the ground
        // distance one delta step covers; no projection maths needed. Widening only (>= 1), so the
        // far ranges keep the stroke they have and only the near field changes.
        float stepMetres = max(length(tx1), length(ty1)) * uMetersPerUnit;
        // The ceiling was 8, and debug view 12 showed it SATURATED over almost the whole frame: one
        // tap step covers ~11 m or less in the near and mid field, so reaching 90 m needs far more
        // than 8x and the widening was being clipped. Clipped means the spacing falls back to
        // stepMetres * 8, which still varies with distance - so the ink stayed a function of WHERE
        // ON SCREEN a pixel is, which is the symptom ("shaded as they enter screen, pale in the
        // centre"). The far field, where the scale is not clipped, is the part that did improve.
        //
        // 64 covers the near field at this ground span. It is a guard against a tap crossing a
        // silhouette, not a look control - uRidgeGroundSpan is the look control.
        float ridgeScale = tangentsValid ? clamp(uRidgeGroundSpan / max(stepMetres, 0.001), 1.0, 64.0) : 1.0;
        debugStepMetres = stepMetres;
        debugRidgeScale = ridgeScale;
        vec2 ridgeDelta = delta * ridgeScale;
        vec3 nx0 = unpackNormal(texture2D(uTerrainDepthTex, uv - vec2(ridgeDelta.x, 0.0)));
        vec3 nx1 = unpackNormal(texture2D(uTerrainDepthTex, uv + vec2(ridgeDelta.x, 0.0)));
        vec3 ny0 = unpackNormal(texture2D(uTerrainDepthTex, uv - vec2(0.0, ridgeDelta.y)));
        vec3 ny1 = unpackNormal(texture2D(uTerrainDepthTex, uv + vec2(0.0, ridgeDelta.y)));
        vec2 dnx = nx1.xy - nx0.xy;
        vec2 dny = ny1.xy - ny0.xy;
        float turn = length(vec2(length(vec2(dnx.x, dny.x)), length(vec2(dnx.y, dny.y))));
        // NORMALISED BY THE GROUND THE TAPS ACTUALLY SPANNED, which is not always the one we asked
        // for. ridgeScale cannot go below 1: a tap can never be narrower than one depth texel. So on
        // a surface seen edge-on, or far away, one texel already covers hundreds of metres and the
        // two normals compared sit on opposite sides of whole ridges - turn comes out huge and the
        // region inks hard. Face-on near ground, where the widening reaches exactly uRidgeGroundSpan,
        // inks modestly. The result is ink that tracks the angle the surface makes with the camera,
        // i.e. WHERE ON SCREEN it is, and it changes as the view rotates.
        //
        // Widening alone cannot fix that half - you cannot sample below a texel - so the measure
        // itself has to become a RATE: how much the normal turns per uRidgeGroundSpan of ground,
        // rather than how much it turned over whatever distance the taps happened to cover. Spans
        // that overshoot are scaled down in proportion; a span that lands on target is unchanged.
        float spanMetres = max(stepMetres * ridgeScale, 0.001);
        turn *= uRidgeGroundSpan / spanMetres;
        debugTurn = turn;
        // LINEAR IN THE TURN, which is peakfinder.com's and is the whole difference between a ridge
        // line and a contour line:
        //
        //     value += length(vec2(length(gradNx), length(gradNz))) * params1.x;
        //
        // No smoothstep, no ramp. Ink PROPORTIONAL to how far the surface turned, so a crest - which
        // turns the normal through tens of degrees over two pixels - inks hard, and an ordinary
        // hillside, which turns it by a hair, inks by a hair.
        //
        // The smoothstep this replaces was a CONTRAST STRETCH: it mapped everything between the
        // threshold and threshold+0.35 onto the full 0..1 range, so whatever sat just above the
        // threshold came out as a solid line. And what sits just above the threshold on a smooth
        // hillside is the 8-BIT QUANTIZATION of the normal buffer - the octahedral pair is 8 bits a
        // component, one step is 2/255 = 0.008, and those steps form closed curves across a slope
        // exactly the way contour lines do. That is what was drawing "slopes" instead of ridges.
        // Their buffer is float, so they never had a floor to sit on.
        //
        // uRidgeThreshold is now a DEADZONE subtracted from the turn, not a ramp start: it is where
        // that quantization floor is, and nothing below it draws at all.
        // SOFT KNEE, NOT A HARD DEADZONE.
        //
        // max(0, turn - threshold) is a CLIFF: a pixel at 0.119 draws nothing and one at 0.131 draws
        // ink. Whole regions sit just under it, so a hair of grazing angle or distance flips them
        // between inked and blank - which is the "random", "changes as I look around", "some tiles
        // lighter" behaviour, and why making the signal more uniform upstream never helped: it moved
        // turn around without moving it off the cliff. Debug view 11 showed the near field solid
        // BLUE, i.e. cut to exactly zero.
        //
        // turn^2 / (turn + knee) is the same idea without the edge: it tends to turn - knee well
        // above the knee (so a real crest inks exactly as before) and falls off quadratically below
        // it (so the 8-bit quantisation floor is still suppressed), but it is continuous, so nothing
        // switches on and off. peakfinder.com has no deadzone here at all.
        float ridgeRamp = turn > 0.0 ? (turn * turn) / (turn + max(uRidgeThreshold, 0.001)) : 0.0;
        // NO GRAZING TERM, which this used to multiply by and the reference does not have. It was
        // added to stop the far wash, and the distance cutoff and the lighting cap below do that
        // properly now - while grazing suppressed the ink on edge-on surfaces, which is precisely
        // where a crest seen IN PROFILE is. It was damping the one thing the term exists to draw.
        edge += ridgeRamp * uRidgeStrength;
    }`
        : `    // Ridges and valleys: the two tangent directions away from this pixel point straight apart on a
    // flat surface (dot -1) and fold together over a crest. Done on eye positions rather than on
    // depth, so a merely oblique slope - which is most of a panorama - does not read as a fold.
    //
    // uCreaseThreshold is where a fold starts counting, and it is the tile-seam control: the mesh
    // kinks where two tiles meet at different levels, and that kink is a SMALL fold where a crest is
    // a large one. uCreaseFade is the creases' own distance fade, separate from the silhouettes':
    // tiles coarsen with distance, so the kinks grow exactly where the folds are worth least.
    if (uCreaseStrength > 0.0 && cover > 0.0) {
        float fold = 0.0;
        if (length(tx0) > minLength && length(tx1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(tx0), normalize(tx1)));
        }
        if (length(ty0) > minLength && length(ty1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(ty0), normalize(ty1)));
        }
        float creaseRamp = smoothstep(uCreaseThreshold, uCreaseThreshold + 0.35, fold);
        edge += creaseRamp * uCreaseStrength * grazing;
    }`
}

    // The terms ADD and then clamp, which is peakfinder.com's accumulation and not the 'max' this
    // used to take. Their pass is literally 'value = ridge; value += silhouette; value += slope',
    // and the difference shows wherever a silhouette and an interior fold land on the same pixel -
    // a crest seen against the range behind it, which is most of the interesting ink in a panorama.
    // Under 'max' the two were interchangeable and the crest drew no darker than either alone.
    //
    // THE DISTANCE CUTOFF, theirs, replacing the two linear fades (uDistanceFade over the
    // silhouettes, uCreaseFade over the interior). Theirs is one smoothstep on the depth:
    //
    //     value = min(value, 1.0 - smoothstep(P0.x - 0.05, P0.x + 0.15, depth))
    //
    // and the shape is the whole point. A linear ramp to a floor leaves ink at EVERY distance, so
    // the far ranges - where ridges are a pixel apart and every one of them is inked - stack into a
    // solid band whatever the floor is set to. A smoothstep goes to exactly zero past its end, so
    // past uInkDistance there is no ink at all and the far ranges are shaded surface only, which is
    // how the reference's horizon stays pale. 0.20 of the far plane by default.
    //
    // Applied to the terrain-against-terrain ink alone. The sky silhouette below is deliberately
    // outside it: the horizon is the one line that must survive at any distance.
    // IN METRES, off the packed depth and the far plane, NOT as a fraction of the far plane.
    //
    // d0 is depth normalised over the frame's own far plane, and that far plane is recomputed every
    // frame from where the view's rays meet the ground (ViewState::calculateViewState). Turning on
    // the spot therefore changes it - look into a valley and it is short, look down a range and it
    // is long - so the SAME hillside lands at a different d0 depending only on which way the camera
    // is pointing. Against a fraction-of-far cutoff that means its ink appears and disappears as you
    // pan, which is exactly what it did.
    //
    // peakfinder.com can use the relative depth because their far plane is fixed. Ours is not, so
    // the faithful equivalent is an absolute distance.
    float distMetres = d0 * uFar * uMetersPerUnit;
    edge = clamp(edge, 0.0, 1.0) * (1.0 - smoothstep(uInkDistance * 0.8, uInkDistance * 1.25, distMetres));

    // Ink capped by how dark the SURFACE under it already is. OFF by default, and NOT the
    // reference's cap however much it looks like it - see below, because the difference cost a
    // release of having no ridge lines at all.
    //
    // Theirs reads:
    //
    //     value = min(value, min(lightning, params2.x));
    //
    // but their 'value' is a SINGLE greyscale channel that already contains the slope shading
    // ('length(n.xz) * P1.z', added two lines earlier) and comes out as the whole picture through
    // 'color = colors.x + (1 - value) * colors.y'. There is no separate surface underneath it. So
    // their min caps the COMBINED darkness against the lighting model - it stops the picture going
    // darker than the light allows, and the ink is only one of the things it is bounding.
    //
    // Ours is a different architecture: RELIEF_SURFACE_SHADER draws the shading into the colour
    // buffer and this pass lays ink over it. Capping our ink by that surface's darkness is not the
    // same operation, and on this palette it is catastrophic: the paper is near white and the haze
    // pulls the distance further towards it, so the surface darkness is ~0 over most of the frame
    // and 'min(edge, 0)' erases every line. Which is exactly what it did.
    //
    // Kept as a knob because dialling a LITTLE of it is a reasonable way to stop ink stacking on
    // ground that is already dark. 0 is uncapped and is the default.
    float paperLuma = dot(uPaperColor.rgb, vec3(0.299, 0.587, 0.114));
    float pixelLuma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    float shadeDarkness = clamp(1.0 - pixelLuma / max(paperLuma, 1.0e-4), 0.0, 1.0);
    edge = min(edge, mix(1.0, shadeDarkness, uInkShadeCap));

    // Terrain against the sky always draws (coverage, not depth: a sky pixel is at the far plane,
    // which a relative threshold would forgive and a difference would saturate).
    float skyNeighbour = 1.0 - min(
        min(unpackCover(texture2D(uTerrainDepthTex, uv - vec2(skyDelta.x, 0.0))), unpackCover(texture2D(uTerrainDepthTex, uv + vec2(skyDelta.x, 0.0)))),
        min(unpackCover(texture2D(uTerrainDepthTex, uv - vec2(0.0, skyDelta.y))), unpackCover(texture2D(uTerrainDepthTex, uv + vec2(0.0, skyDelta.y)))));
    edge = max(edge, skyNeighbour * unpackCover(c0));

    // AR: the ink and the LABELS, and nothing else. The frame is a hole for the camera preview, so
    // paper, haze and the surface's own shading would each be a sheet drawn over the picture. Alpha
    // carries the result - and it is why this cannot just be a colour: the effect writes every
    // pixel, so an opaque alpha here hid the preview however transparent the clear colour was.
    //
    // uColorTex is NOT discarded here, which it used to be. Everything that is not terrain surface
    // is in it - and in this mode that means the summit names, their plates and their leader lines,
    // which is most of what the mode is for. Throwing the buffer away drew the ridge lines alone and
    // no labels at all.
    //
    // PREMULTIPLIED on both sides, which is not a detail. The SDK renders with
    // glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA) (MapRenderer::initializeRenderState), so the
    // offscreen buffer is already premultiplied and composites with a plain source-over. And the
    // OUTPUT has to be premultiplied too: a translucent GL surface is composited by the system that
    // way (SurfaceFlinger on android, CoreAnimation on iOS), so a straight colour with a low alpha
    // is added at FULL strength over what is behind it. Between the lines the alpha is near zero and
    // the rgb was still the ink's, which the compositor read as a sheet of ink over the whole
    // preview - the grey veil, darkest under the light palette whose ink is near black.
    if (uTransparent > 0.5) {
        float inkAlpha = edge * uInkColor.a * uIntensity;
        vec4 ink = vec4(uInkColor.rgb * inkAlpha, inkAlpha);
        // Labels OVER the lines: a name crossed by the ridge it belongs to is unreadable, and the
        // plate exists to sit on top of the picture.
        gl_FragColor = color + ink * (1.0 - color.a);
        return;
    }

    // Aerial perspective: the surface fades into the paper with distance, so the far ranges read as
    // pale outlines and the near ground keeps what shading it has.
    // In metres, not in normalised depth: this rode on d0, and d0 is over a far plane that is
    // recomputed every frame (1229 km in a panorama, where the terrain stops at 150), so the amount
    // depended on where the camera pointed. It is only the INK that fades here now.
    float haze = uHaze * clamp(distMetres / max(uHazeDistance, 1.0), 0.0, 1.0) * unpackCover(c0);
    // THE SURFACE IS NOT HAZED AGAIN HERE. RELIEF_SURFACE_SHADER already pulled it towards the paper
    // by this exact amount, over this exact distance, and the SDK puts the frame's own fog on top of
    // that as well - so mixing it a second time here compounds. At 30 km that was 1 - 0.65*0.65, or
    // 58% of the way to white; at 60 km, 91%. The far ranges went blank while the near ground, where
    // the haze is near zero, kept everything - which is why the picture looked like it had a
    // near/far cutoff rather than an aerial perspective.
    //
    // This is the same mistake the note at the top of this file records the surface shader making,
    // reintroduced from the other side. The haze belongs to WHOEVER DRAWS THE SURFACE, once.
    vec3 shaded = color.rgb;
    // THE INK HAZES TOO. It used to be laid over the hazed surface at full strength, so the far
    // ranges paled and their outlines stayed black - the one combination aerial perspective never
    // produces, and the reason the horizon read as a hard band against washed-out ground. The
    // reference's far ranges are pale INCLUDING their lines.
    vec3 hazedInk = mix(uInkColor.rgb, uPaperColor.rgb, haze);
    vec3 stylized = mix(shaded, hazedInk, edge * uInkColor.a);

    // DEBUG VIEWS. Each one dumps a single intermediate term as an image, so a screenshot says
    // which stage is wrong instead of us inferring it from the finished picture. Driven by the
    // peakFinderDebugView setting. Terrain only - sky and labels are left alone so there is
    // something to orient by. White means the term is alive here, black means it is zero.
    // 8: WHAT IS ACTUALLY IN THE G-BUFFER HERE, one colour per case. The other views all gate on
    // cover, so a region that was never drawn falls through them to the normal picture and reads as
    // "the effect is weak here" rather than "there is nothing here". Three causes produced the same
    // lavender in view 6 - sky clear, a genuinely flat normal, and a degenerate one - and telling
    // them apart is the whole question.
    //   GREEN   sky / never drawn (the pass clears BA to 0.5, 0.5)
    //   RED     degenerate normal: the packing shader hit its l1 <= 0.0001 fallback
    //   BLUE    real, flat
    //   GREY    real, sloped - brighter with more slope
    // 11: the RAW RIDGE SIGNAL before threshold and strength, x8 so it is readable. If a region is
    //     dark here its normals genuinely do not turn across the taps; if it is bright here but pale
    //     in the finished picture, the signal exists and something after this is discarding it.
    // 12: the ground metres one tap step covers (x) and the widening factor applied (y), as
    //     red = stepMetres/500 and green = ridgeScale/8. These are the only two quantities in the
    //     ink that vary with WHERE ON SCREEN a pixel is, which is what the symptom tracks.
    // 14: DOES THE SLIDER REACH THE SHADER AT ALL? "Changing the threshold does nothing" has been
    //     treated as a statement about the ink, but it is equally a statement about the uniform, and
    //     that was never checked. Flat bands straight off the two values, nothing else in them:
    //       left half  = uRidgeThreshold / 0.3   (full slider range)
    //       right half = uRidgeStrength / 4.0
    //     Move either slider and the corresponding half MUST change brightness. If it does not, the
    //     value is not arriving and every ink-side change so far has been landing on stale uniforms.
    if (uDebugView > 13.5) {
        float value = (gl_FragCoord.x * uInvScreenSize.x < 0.5) ? uRidgeThreshold / 0.3 : uRidgeStrength / 4.0;
        value = clamp(value, 0.0, 1.0);
        gl_FragColor = vec4(value, value, value, 1.0);
        return;
    }
    if (uDebugView > 10.5 && uDebugView < 11.5) {
        // THE THRESHOLD, SHOWN AGAINST THE SIGNAL. The previous version of this view was
        // clamp(turn * 8), which saturates at 0.125 - and uRidgeThreshold sits at 0.12, so the whole
        // decisive range rendered as flat white and the view looked healthy while the picture stayed
        // pale. A debug view scaled across the exact band that decides the answer is worse than none.
        //
        //   BLUE  turn is under uRidgeThreshold: this pixel is cut to exactly zero ink
        //   RED   within 25% above the threshold: survives, but so faintly it will not read
        //   GREY  comfortably above it, brightness = the ink this actually contributes
        if (debugTurn < uRidgeThreshold) {
            gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
            return;
        }
        if (debugTurn < uRidgeThreshold * 1.25) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            return;
        }
        float contribution = clamp((debugTurn - uRidgeThreshold) * uRidgeStrength, 0.0, 1.0);
        gl_FragColor = vec4(contribution, contribution, contribution, 1.0);
        return;
    }
    // BOUNDED. Unbounded, this swallowed view 13: 13 > 11.5 is true, so the post-process painted the
    // step/scale image over the surface shader's tile checker and the view could never be seen.
    if (uDebugView > 11.5 && uDebugView < 12.5) {
        gl_FragColor = vec4(clamp(debugStepMetres / 500.0, 0.0, 1.0), clamp(debugRidgeScale / 64.0, 0.0, 1.0), 0.0, 1.0);
        return;
    }
    if (uDebugView > 7.5 && uDebugView < 8.5) {
        if (cover <= 0.0) {
            gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
            return;
        }
        vec2 rawOct = c0.ba * 2.0 - 1.0;
        if (abs(rawOct.x) + abs(rawOct.y) > 1.02) {
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
            return;
        }
        float slope = length(unpackNormal(c0).xy);
        gl_FragColor = slope < 0.01 ? vec4(0.0, 0.0, 1.0, 1.0) : vec4(vec3(0.25 + slope), 1.0);
        return;
    }
    if (uDebugView > 0.5 && uDebugView < 6.5 && cover > 0.0) {
        vec3 debugNormal = unpackNormal(c0);
        float value = 0.0;
        if (uDebugView < 1.5) {
            value = length(debugNormal.xy);                       // 1: SLOPE from the packed normal
        } else if (uDebugView < 2.5) {
            value = edge;                                         // 2: the final ink
        } else if (uDebugView < 3.5) {
            value = haze;                                         // 3: how far it is hazed out
        } else if (uDebugView < 4.5) {
            value = clamp(distMetres / 100000.0, 0.0, 1.0);       // 4: distance, white at 100 km
        } else if (uDebugView < 5.5) {
            value = clamp(d0 * 20.0, 0.0, 1.0);                   // 5: raw packed depth, x20
        } else {
            // 6: the normal itself as colour, so a tile whose normals disagree with its neighbour
            // shows as a seam and a flat tile shows as pure blue.
            gl_FragColor = vec4(debugNormal * 0.5 + 0.5, 1.0);
            return;
        }
        gl_FragColor = vec4(value, value, value, 1.0);
        return;
    }

    gl_FragColor = vec4(mix(color.rgb, stylized, uIntensity), 1.0);
}`;
}
