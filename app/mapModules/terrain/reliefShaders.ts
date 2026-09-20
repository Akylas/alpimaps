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
    light: { ink: '#14141a', paper: '#f7f7f4', shade: '#6c7280', sky: '#9fc6e8', labelSecondary: '#6b7280' },
    dark: { ink: '#e8ecf5', paper: '#10131a', shade: '#5a6070', sky: '#070a12', labelSecondary: '#9aa3b2' },
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
 * No fog term: the SDK applies the frame's own fog to whatever this returns.
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
    return vec4(color, 1.0);
}`;

/**
 * The ridge lines: silhouettes and creases reconstructed from the packed terrain depth the renderer
 * hands the effect. Without this the shaded surface is a grey wash, which is what makes it look like
 * the mode did not come on at all. Needs `terrainDepthRequired = true`.
 *
 * Uniforms: uIntensity, uOutlineWidth, uHorizonBoost, uDepthThreshold, uCreaseStrength,
 * uCreaseThreshold, uCreaseFade, uDepthTexelSize, uGrazingFloor, uDistanceFade, uHaze, uInkColor,
 * uPaperColor.
 *
 * Diverges from the android demo in one place, and deliberately: the crease test's threshold and its
 * distance fade are parameters here rather than the demo's two constants. They are what separates a
 * ridge from a TILE SEAM — see `peakFinderCreaseThreshold`.
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
uniform float uCreaseThreshold;
uniform float uCreaseFade;
uniform float uTransparent;
uniform float uSlopeStrength;
uniform float uSlopeMultiplier;
uniform float uSlopeBias;
uniform float uDepthTexelSize;
uniform float uGrazingFloor;
uniform float uDistanceFade;
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

float unpackDepth(vec4 c) {
    return dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
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
    float behind = max(max(dx0 - d0, dx1 - d0), max(dy0 - d0, dy1 - d0));
    float threshold = uDepthThreshold * (0.0008 + 0.02 * d0) / max(grazing, uGrazingFloor);
    float edge = smoothstep(threshold, threshold * 2.0, behind);
    // Terrain-against-terrain lines fade with distance so that the horizon - the sky silhouette
    // below, which does not fade - is the boldest line in the frame.
    edge *= mix(1.0, uDistanceFade, d0);
    // ...and terrain against the sky always is one (coverage, not depth: a sky pixel is at the far
    // plane, which a relative threshold would forgive and a difference would saturate).
    float skyNeighbour = 1.0 - min(
        min(texture2D(uTerrainDepthTex, uv - vec2(skyDelta.x, 0.0)).a, texture2D(uTerrainDepthTex, uv + vec2(skyDelta.x, 0.0)).a),
        min(texture2D(uTerrainDepthTex, uv - vec2(0.0, skyDelta.y)).a, texture2D(uTerrainDepthTex, uv + vec2(0.0, skyDelta.y)).a));
    edge = max(edge, skyNeighbour * c0.a);

    // Ridges and valleys: the two tangent directions away from this pixel point straight apart on a
    // flat surface (dot -1) and fold together over a crest. Done on eye positions rather than on
    // depth, so a merely oblique slope - which is most of a panorama - does not read as a fold.
    //
    // uCreaseThreshold is where a fold starts counting, and it is the tile-seam control: the mesh
    // kinks where two tiles meet at different levels, and that kink is a SMALL fold where a crest is
    // a large one. uCreaseFade is the creases' own distance fade, separate from the silhouettes':
    // tiles coarsen with distance, so the kinks grow exactly where the folds are worth least.
    float cover = min(min(cx0.a, cx1.a), min(cy0.a, cy1.a)) * c0.a;
    if (uCreaseStrength > 0.0 && cover > 0.0) {
        float fold = 0.0;
        if (length(tx0) > minLength && length(tx1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(tx0), normalize(tx1)));
        }
        if (length(ty0) > minLength && length(ty1) > minLength) {
            fold = max(fold, 1.0 + dot(normalize(ty0), normalize(ty1)));
        }
        float creaseRamp = smoothstep(uCreaseThreshold, uCreaseThreshold + 0.35, fold);
        edge = max(edge, creaseRamp * uCreaseStrength * grazing * mix(1.0, uCreaseFade, d0));
    }

    // SLOPES, which is what the two terms above cannot draw: geo-three's whole outline effect
    // (webapp/app.ts, CustomOutlineEffect), which is a symmetric depth GRADIENT rather than a
    // silhouette test.
    //
    //     depthDiff = sum of |depth - neighbour| over the four taps
    //     ink       = pow(depthDiff * depthMultiplier, depthBiais)
    //
    // Two things make it paint the relief where ours painted nothing. It is SYMMETRIC - a neighbour
    // nearer counts as much as one further, so the face turned away from the camera inks as well as
    // the edge in front of it. And the exponent is far BELOW one (0.23), which lifts small
    // differences hard: a gentle slope whose depth changes by a thousandth between neighbouring
    // pixels comes out at a third of full ink instead of nothing. What stays white is ground
    // square-on to the camera, where the depth barely changes across a pixel - so the flat valley
    // floor reads as paper and every slope above it carries a line.
    //
    // Deliberately NOT multiplied by the grazing term, unlike the crease: obliqueness is the signal
    // here, not the thing to compensate for. The same four taps as the silhouette, rather than a
    // stroke width of its own, so the term costs arithmetic and not four more texture fetches.
    if (uSlopeStrength > 0.0 && cover > 0.0) {
        float depthDiff = abs(d0 - dx0) + abs(d0 - dx1) + abs(d0 - dy0) + abs(d0 - dy1);
        float slopeInk = pow(clamp(depthDiff * uSlopeMultiplier, 0.0, 1.0), uSlopeBias);
        edge = max(edge, slopeInk * uSlopeStrength);
    }

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
    vec3 shaded = mix(color.rgb, uPaperColor.rgb, uHaze * d0 * c0.a);
    vec3 stylized = mix(shaded, uInkColor.rgb, edge * uInkColor.a);

    gl_FragColor = vec4(mix(color.rgb, stylized, uIntensity), 1.0);
}`;
