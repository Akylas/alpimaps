import { isEInk } from '~/helpers/theme';

/**
 * Surface shader must not apply fog (the SDK does). v_normal, v_worldPos, v_demUv, v_elevation, v_dist and
 * the u_sun, u_fog, u_dem uniforms are built in: redeclaring one is a compile error, and a shader that
 * fails to compile is silently dropped.
 */

export const RELIEF_PALETTE = {
    // `shade` IS `ink` on purpose: peakfinder.com's panorama is one greyscale value, so slope shading
    // and ridge lines differ in amount only, never in hue.
    light: { ink: '#000000', paper: '#ffffff', shade: '#000000', sky: '#9fc6e8', labelSecondary: '#6b7280' },
    dark: { ink: '#ffffff', paper: '#000000', shade: '#ffffff', sky: '#070a12', labelSecondary: '#9aa3b2' },
    // e-ink dithers mid tones: pure ink/paper, and a LIGHT shade so the ink does the reading
    eink: { ink: '#000000', paper: '#ffffff', shade: '#c0c0c0', sky: '#ffffff', labelSecondary: '#000000' },
    // `eink` swapped, not `dark`: its mid tones would dither
    einkDark: { ink: '#ffffff', paper: '#000000', shade: '#404040', sky: '#000000', labelSecondary: '#ffffff' }
};

export type ReliefPalette = (typeof RELIEF_PALETTE)['light'];

/** E-ink has its own light/dark pair: the mid-tone palettes only dither there. */
export function reliefPalette(dark: boolean): ReliefPalette {
    if (isEInk) {
        return dark ? RELIEF_PALETTE.einkDark : RELIEF_PALETTE.eink;
    }
    return dark ? RELIEF_PALETTE.dark : RELIEF_PALETTE.light;
}

export const RELIEF_DEFAULTS = {
    /**
     * `EARTH_CIRCUMFERENCE / WORLD_SIZE`. A PostProcessEffect's `uFar` is in internal units and, unlike
     * the surface shader, it gets no `u_metersPerUnit` from the SDK.
     */
    metersPerUnit: 40075016.68558 / (1 << 20),
    depthThreshold: 1,
    /** The depth texture is half resolution, so a narrower step samples the same texel twice. */
    depthTexelSize: 2,
    /** How far the silhouette test is relaxed where the surface is seen edge-on. */
    grazingFloor: 0.15
};

/** geo-three's terrain LOD (`LODFrustum`), fed to `TerrainOptions.setSubdivideDistance`. */
export const GEO_THREE = {
    /** LODFrustum.subdivideDistance on desktop. */
    subdivideDistance: 70
};

/** peakfinder.com's look (`cfg=es`, see `peakfinder-reference-shader.md`; derivation in the SDK web bench's PANORAMA-NOTES.md). */
export const PEAKFINDER_LOOK = {
    /** Ink off the DEM's curvature, per pixel of ground (`uRidgeInkStrength`). */
    ridgeInk: 0.3,
    /** The curvature's ground span, metres (`TerrainOptions.normalSampleDistance`). */
    normalSampleDistance: 40,
    /**
     * Max ink of the ridge texture (`uAmbient`), standing in for their shadow-buffer term. Not capped by
     * the sun, or every sunlit face is blank paper: the sun shades via `peakFinderHillshade`.
     */
    ambient: 0.06,
    inkCap: 0.3,
    /** Silhouettes only (`uOperator` 2): the relative depth jump that inks, and its gain. */
    silhouetteFloor: 0.008,
    silhouetteGain: 12,
    /** Their silhouette lines are 0.2 grey and their skyline 0.1. */
    silhouetteInk: 0.8,
    skylineInk: 0.9
};

/**
 * peakfinder.com's model: slope + ridge terms ADDED, CAPPED by the light, then mixed paper -> shade,
 * hillshade added after the cap. No fog term: the SDK applies the frame's own fog.
 */
export const RELIEF_SURFACE_SHADER = `
uniform vec4 uPaperColor;
uniform vec4 uShadeColor;
uniform float uShadeStrength;
uniform float uSlopeShade;
uniform float uAmbient;
uniform float uHillshade;
// The most ink the light allows anywhere (theirs 0.3).
uniform float uInkCap;
// ridge term: how far the normal turns across one screen pixel (peakfinder.com's interior line)
uniform float uRidgeInkStrength;
float normalTurn(vec3 n) {
#ifdef GL_OES_standard_derivatives
    return length(vec2(length(dFdx(n)), length(dFdy(n))));
#else
    return 0.0;
#endif
}
vec4 surfaceColor() {
    // a SKIRT is a crack filler: shaded with the ground's normal it bands hard black/white
    if (v_normal.z < 0.0) {
        return vec4(uPaperColor.rgb, 1.0);
    }
    // the mesh's own normal: per-fragment DEM taps were 58 ms of a 100 ms frame on an Adreno 610
    vec3 n = normalize(v_normal);
    // capped by the light: a sunlit face stays paper, only the shadow side shows its gullies
    vec3 sun = normalize(u_sunDir);
    float value = uSlopeShade * length(n.xy) + uRidgeInkStrength * normalTurn(n);
    float light = min(uAmbient + uShadeStrength * max(-0.2, -dot(n, sun)), 1.0);
    value = min(value, min(light, uInkCap));
    // hillshade on top of the cap
    value = clamp(value + uHillshade * max(sun.z - dot(n, sun), 0.0), -1.0, 1.0);
    return vec4(clamp(mix(uPaperColor.rgb, uShadeColor.rgb, value), 0.0, 1.0), 1.0);
}`;

/**
 * `reliefDepthOutlineShader` specialised to silhouettes only. Not a runtime switch: on an Adreno 610 unused
 * branches cost as much as used ones. `rings` is `ceil(uOutlineWidth) - 1`: crossing an integer = new shader.
 */
export function reliefSilhouetteShader({ ar = false, rings = 0 }: { ar?: boolean; rings?: number } = {}) {
    const ringCount = Math.max(0, Math.min(3, Math.round(rings)));
    // width 1 to 2: the far side of the edge as the second pixel, off the same five taps
    const farSide = `    float c = inverseDepth(depth);
    float e1 = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(uInvScreenSize.x, 0.0)));
    float w1 = inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(uInvScreenSize.x, 0.0)));
    float n1 = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(0.0, uInvScreenSize.y)));
    float s1 = inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(0.0, uInvScreenSize.y)));
    float laplacian = e1 + w1 + n1 + s1 - 4.0 * c;
    float edge = ink(max(-laplacian / c, 0.0)) * clamp(uOutlineWidth, 0.0, 1.0);
    edge = max(edge, ink(max(laplacian, 0.0) / max(max(max(e1, w1), max(n1, s1)), c)) * clamp(uOutlineWidth - 1.0, 0.0, 1.0));`;
    // past 2 the line dilates; the first ring shares taps: 13 reads instead of 25
    const firstRing = `    {
        vec2 o = uInvScreenSize;
        float e2 = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(2.0 * o.x, 0.0)));
        float w2 = inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(2.0 * o.x, 0.0)));
        float n2 = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(0.0, 2.0 * o.y)));
        float s2 = inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(0.0, 2.0 * o.y)));
        float ne = inverseDepth(texture2D(uTerrainDepthTex, uv + o));
        float nw = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(-o.x, o.y)));
        float se = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(o.x, -o.y)));
        float sw = inverseDepth(texture2D(uTerrainDepthTex, uv - o));
        float ringOperator = max(max(relativeLaplacian(e1, e2, c, ne, se), relativeLaplacian(w1, c, w2, nw, sw)),
                                 max(relativeLaplacian(n1, ne, nw, n2, c), relativeLaplacian(s1, se, sw, c, s2)));
        edge = max(edge, ink(ringOperator) * clamp(uOutlineWidth - 2.0, 0.0, 1.0));
    }`;
    const ringCode = Array.from({ length: Math.max(0, ringCount - 2) }, (unused, index) => {
        const ring = index + 2;
        return `    {
        vec2 reach = uInvScreenSize * ${ring}.0;
        float ringOperator = max(max(silhouetteAt(uv + vec2(reach.x, 0.0)), silhouetteAt(uv - vec2(reach.x, 0.0))),
                                 max(silhouetteAt(uv + vec2(0.0, reach.y)), silhouetteAt(uv - vec2(0.0, reach.y))));
        edge = max(edge, ink(ringOperator) * clamp(uOutlineWidth - ${ring + 1}.0, 0.0, 1.0));
    }`;
    }).join('\n');
    return `#version 100
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uColorTex;
uniform sampler2D uTerrainDepthTex;
uniform vec2 uInvScreenSize;
uniform float uFar;
uniform float uMetersPerUnit;
uniform float uIntensity;
uniform float uOutlineWidth;
uniform float uOutlineGain;
uniform float uOutlineFloor;
uniform float uHorizonBoost;
uniform float uHorizonWidth;
uniform vec4 uInkColor;
${ar ? LENS_DISTORTION_GLSL : ''}
// 1 / distance, 0 for the sky - see reliefDepthOutlineShader's inverseDepthAt.
float inverseDepth(vec4 c) {
    return c.a < 0.5 ? 0.0 : 1.0 / max(dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0)) * uFar * uMetersPerUnit, 1.0);
}
// The laplacian of inverse depth, near side only, relative to the centre: where this pixel hides
// ground behind it. A sky neighbour counts as infinitely far, so the skyline is a silhouette too.
float silhouette(vec2 uv, float centre) {
    vec2 offset = uInvScreenSize;
    float laplacian = inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(offset.x, 0.0))) + inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(offset.x, 0.0)))
                    + inverseDepth(texture2D(uTerrainDepthTex, uv + vec2(0.0, offset.y))) + inverseDepth(texture2D(uTerrainDepthTex, uv - vec2(0.0, offset.y)))
                    - 4.0 * centre;
    return max(-laplacian / centre, 0.0);
}
${
    ringCount > 1
        ? `// The same operator off five inverse depths already read; the sky neighbour of a pixel counts as
// infinitely far, a sky centre as no operator at all.
float relativeLaplacian(float centre, float a, float b, float c, float d) {
    return centre > 0.0 ? max(-(a + b + c + d - 4.0 * centre) / centre, 0.0) : 0.0;
}
float silhouetteAt(vec2 uv) {
    float centre = inverseDepth(texture2D(uTerrainDepthTex, uv));
    return centre > 0.0 ? silhouette(uv, centre) : 0.0;
}`
        : ''
}
float ink(float relative) {
    return clamp((relative - uOutlineFloor) * uOutlineGain, 0.0, 1.0) * uIntensity;
}

void main(void) {
    vec2 uv = ${ar ? 'distortUv(gl_FragCoord.xy * uInvScreenSize)' : 'gl_FragCoord.xy * uInvScreenSize'};
    vec4 color = texture2D(uColorTex, uv);
    vec4 depth = texture2D(uTerrainDepthTex, uv);
    // Sky: nothing to outline.
    if (depth.a < 0.5) {
        gl_FragColor = color;
        return;
    }
${ringCount > 0 ? farSide + (ringCount > 1 ? '\n' + firstRing : '') : '    float edge = ink(silhouette(uv, inverseDepth(depth))) * clamp(uOutlineWidth, 0.0, 1.0);'}
${ringCode}
    // THE SKYLINE, as a stroke of its own width: any sky neighbour that far away.
    vec2 skyOffset = uInvScreenSize * max(uHorizonWidth, 1.0);
    float skyNeighbour = 1.0 - min(
        min(texture2D(uTerrainDepthTex, uv + vec2(skyOffset.x, 0.0)).a, texture2D(uTerrainDepthTex, uv - vec2(skyOffset.x, 0.0)).a),
        min(texture2D(uTerrainDepthTex, uv + vec2(0.0, skyOffset.y)).a, texture2D(uTerrainDepthTex, uv - vec2(0.0, skyOffset.y)).a));
    edge = clamp(max(edge, skyNeighbour * uHorizonBoost), 0.0, 1.0);
${
    ar
        ? `    // AR: PREMULTIPLIED over the hole the camera preview shows through, labels over the lines.
    float inkAlpha = edge * uInkColor.a;
    gl_FragColor = color + vec4(uInkColor.rgb * inkAlpha, inkAlpha) * (1.0 - color.a);`
        : '    gl_FragColor = vec4(mix(color.rgb, uInkColor.rgb, edge), color.a);'
}
}
`;
}

/**
 * The AR lens warp, shared by both outline shaders: its uniforms and `distortUv`.
 */
const LENS_DISTORTION_GLSL = `// Lens distortion (AR): coefficients exactly as Camera2's LENS_DISTORTION, centre in the same tangent
// units, all zero = identity. Scalars because PostProcessEffect carries float and colour uniforms only.
uniform float uDistortK1;
uniform float uDistortK2;
uniform float uDistortK3;
uniform float uDistortP1;
uniform float uDistortP2;
uniform float uDistortCenterX;
uniform float uDistortCenterY;
// Half-field tangents of the screen and of the (wider) render, see arGeometry in features/peakFinder.ts.
uniform float uDistortScreenTanX;
uniform float uDistortScreenTanY;
uniform float uDistortRenderTanX;
uniform float uDistortRenderTanY;
// 1 for a portrait AR view: the coordinates are rotated, not the coefficients.
uniform float uDistortRotate;

// Where to sample the rectilinear render: inverse Brown-Conrady by fixed-point iteration (no closed
// form; converges in 2-3 rounds). The render is wider than the screen: barrel distortion maps corners outside it.
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
`;

export function reliefDepthOutlineShader() {
    return `#version 100
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform sampler2D uColorTex;
uniform sampler2D uTerrainDepthTex;
uniform vec2 uInvScreenSize;
uniform float uFar;
uniform float uIntensity;
// 0 geo-three's (linear depth over uDepthNear..uDepthFar), 1 ours relative to the depth, 2 silhouettes
// only (peakfinder.com's lines) - see operatorAt.
uniform float uOperator;
uniform float uOutlineWidth;
uniform float uOutlineGain;
uniform float uOutlinePower;
uniform float uOutlineFloor;
uniform float uOutlineCeiling;
uniform float uInkSky;
uniform float uHorizonBoost;
uniform float uHorizonWidth;
// The camera range the outline measures depth over, metres. uDepthFar 0 is the frame's own far plane.
uniform float uDepthNear;
uniform float uDepthFar;
// The reference's hardware depth: its bits (0 keeps our own linear depth) and world units per metre.
uniform float uDepthBits;
uniform float uDepthUnit;
uniform float uMetersPerUnit;
uniform vec4 uInkColor;
// AR: the frame is a hole for the camera preview and only the ink is drawn - see reliefOutlineShader.
uniform float uTransparent;

${LENS_DISTORTION_GLSL}

float unpackDepth(vec4 c) {
    return dot(c.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0));
}
float coverage(vec4 c) {
    return c.a;
}
float depthAt(vec2 uv) {
    return unpackDepth(texture2D(uTerrainDepthTex, uv));
}
float metresAt(vec4 c) {
    return unpackDepth(c) * uFar * uMetersPerUnit;
}
// geo-three's depth: LINEAR over the camera's near..far (10 m..173 km), unlike ours over a per-frame far
// plane (up to 1229 km), so no parameter value transfers. Sky is 1; ground past uDepthFar is not clipped.
float linearDepthAt(vec2 uv) {
    vec4 c = texture2D(uTerrainDepthTex, uv);
    if (coverage(c) < 0.5) {
        return 1.0;
    }
    float metres = metresAt(c);
    float farMetres = uDepthFar > 0.0 ? uDepthFar : uFar * uMetersPerUnit;
    if (uDepthBits > 0.0) {
        // the reference's hardware depth: perspective over near..far in its units, quantised to uDepthBits
        // and linearised back (perspectiveDepthToViewZ / viewZToOrthographicDepth)
        float near = uDepthNear * uDepthUnit;
        float far = farMetres * uDepthUnit;
        float hardware = (far / (far - near)) * (1.0 - near / max(metres * uDepthUnit, near));
        float steps = exp2(uDepthBits) - 1.0;
        hardware = floor(hardware * steps + 0.5) / steps;
        float viewZ = (near * far) / ((far - near) * hardware - far);
        return (viewZ + near) / (near - far);
    }
    return max((metres - uDepthNear) / max(farMetres - uDepthNear, 1.0), 0.0);
}
// 1 / distance, 0 for the sky: on any PLANE this is linear in screen space, so its laplacian is zero
// on every slope however steep or far, and only a crease or an occlusion survives it.
float inverseDepthAt(vec2 uv) {
    vec4 c = texture2D(uTerrainDepthTex, uv);
    return coverage(c) < 0.5 ? 0.0 : 1.0 / max(metresAt(c), 1.0);
}

// The outline operator at one pixel, over taps one pixel away.
float operatorAt(vec2 uv) {
    vec2 offset = uInvScreenSize;
    if (uOperator > 1.5) {
        // silhouettes only (peakfinder.com's lines): near-side laplacian of inverse depth, relative so a
        // jump inks the same near or far; a sky neighbour counts as infinitely far
        float centre = inverseDepthAt(uv);
        if (centre <= 0.0) {
            return 0.0;
        }
        float laplacian = inverseDepthAt(uv + vec2(offset.x, 0.0)) + inverseDepthAt(uv - vec2(offset.x, 0.0))
                        + inverseDepthAt(uv + vec2(0.0, offset.y)) + inverseDepthAt(uv - vec2(0.0, offset.y))
                        - 4.0 * centre;
        return max(-laplacian / centre, 0.0);
    }
    if (uOperator > 0.5) {
        float depth = depthAt(uv);
        float diff = abs(depth - depthAt(uv + vec2(offset.x, 0.0)))
                   + abs(depth - depthAt(uv - vec2(offset.x, 0.0)))
                   + abs(depth - depthAt(uv + vec2(0.0, offset.y)))
                   + abs(depth - depthAt(uv - vec2(0.0, offset.y)));
        // Scaled by the depth itself, so a far ridge inks like a near one: the same ground step is a
        // smaller fraction of the far plane the further away it is.
        return diff / max(depth, 0.0001);
    }
    // The reference's operator, term for term: four taps of a LINEAR depth, summed as absolute
    // differences, and no division by anything. The scale lives in uDepthNear/uDepthFar.
    float centreLinear = linearDepthAt(uv);
    return abs(centreLinear - linearDepthAt(uv + vec2(offset.x, 0.0)))
         + abs(centreLinear - linearDepthAt(uv - vec2(offset.x, 0.0)))
         + abs(centreLinear - linearDepthAt(uv + vec2(0.0, offset.y)))
         + abs(centreLinear - linearDepthAt(uv - vec2(0.0, offset.y)));
}

// floor, gain, power, ceiling, then intensity. The operator is a gradient MAGNITUDE, so its slope term
// IS the hillshade (floor 0 = reference). uOutlineCeiling unset reads as 1.
float inkOf(float relative) {
    float ceiling = uOutlineCeiling > 0.0 ? uOutlineCeiling : 1.0;
    return min(pow(max((relative - uOutlineFloor) * uOutlineGain, 0.0), max(uOutlinePower, 0.01)), ceiling) * uIntensity;
}

void main(void) {
    // The post-process vertex stage passes no varying, so the uv is the fragment's own coordinate -
    // through the lens warp, so the scene, the depth and every tap stay registered in AR.
    vec2 v_uv = distortUv(gl_FragCoord.xy * uInvScreenSize);
    vec4 color = texture2D(uColorTex, v_uv);
    vec4 centre = texture2D(uTerrainDepthTex, v_uv);
    // Sky: nothing to outline, and the neighbour test would draw the horizon twice. uInkSky 1 runs it
    // anyway, as the reference does: its sky is depth 1, so the skyline is inked on BOTH sides.
    if (coverage(centre) < 0.5 && uInkSky < 0.5) {
        gl_FragColor = color;
        return;
    }
    // uOutlineWidth DILATES the one-pixel operator (wider taps greyed the picture), fractionally: a ring
    // is inked by how far the width reaches into it
    float width = uOutlineWidth > 0.0 ? uOutlineWidth : 1.0;
    float edge = inkOf(operatorAt(v_uv)) * clamp(width, 0.0, 1.0);
    for (int ring = 1; ring < 4; ring++) {
        float weight = clamp(width - float(ring), 0.0, 1.0);
        if (weight <= 0.0) {
            break;
        }
        vec2 reach = uInvScreenSize * float(ring);
        float ringOperator = max(max(operatorAt(v_uv + vec2(reach.x, 0.0)), operatorAt(v_uv - vec2(reach.x, 0.0))),
                                 max(operatorAt(v_uv + vec2(0.0, reach.y)), operatorAt(v_uv - vec2(0.0, reach.y))));
        edge = max(edge, inkOf(ringOperator) * weight);
    }
    // the skyline as its own stroke; terrain side only, adding to the reference's two-sided one (uInkSky)
    vec2 skyOffset = uInvScreenSize * max(uHorizonWidth, 1.0);
    float skyNeighbour = 1.0 - min(
        min(coverage(texture2D(uTerrainDepthTex, v_uv + vec2(skyOffset.x, 0.0))),
            coverage(texture2D(uTerrainDepthTex, v_uv - vec2(skyOffset.x, 0.0)))),
        min(coverage(texture2D(uTerrainDepthTex, v_uv + vec2(0.0, skyOffset.y))),
            coverage(texture2D(uTerrainDepthTex, v_uv - vec2(0.0, skyOffset.y)))));
    edge = clamp(max(edge, skyNeighbour * coverage(centre) * uHorizonBoost), 0.0, 1.0);
    if (uTransparent > 0.5) {
        // PREMULTIPLIED, and the labels over the lines, as in reliefOutlineShader.
        float inkAlpha = edge * uInkColor.a;
        gl_FragColor = color + vec4(uInkColor.rgb * inkAlpha, inkAlpha) * (1.0 - color.a);
        return;
    }
    gl_FragColor = vec4(mix(color.rgb, uInkColor.rgb, edge), color.a);
}
`;
}

/**
 * `normals: true` reads the terrainNormalsRequired buffer (16-bit sqrt depth in RG, normal in BA): ridges
 * come off the normal gradient, which ignores LOD seams. `false`: 24-bit depth + coverage, folds rebuilt
 * from depth, which cannot tell a crest from a tile seam.
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
// no normal in this layout: debug views report flat
vec3 unpackNormal(vec4 c) {
    return vec3(0.0, 0.0, 1.0);
}`
}

${LENS_DISTORTION_GLSL}

vec3 eyePos(vec2 uv, float depth) {
    vec2 ndc = uv * 2.0 - 1.0;
    return vec3(ndc * uProjInvScale, -1.0) * depth * uFar;
}

void main(void) {
    // the ONE place the lens warp is applied, so scene, depth, taps and labels stay registered
    vec2 uv = distortUv(gl_FragCoord.xy * uInvScreenSize);
    vec4 color = texture2D(uColorTex, uv);
    vec4 c0 = texture2D(uTerrainDepthTex, uv);
    float d0 = unpackDepth(c0);

    // one width for terrain lines (widening with distance smears far ranges); the sky gets its own.
    // Never under uDepthTexelSize: the depth is half resolution, nearest filtered.
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

    // peakfinder.com's silhouette: a two-sided DEPTH GRADIENT, fixed gate, scaled by its magnitude, and not
    // relaxed by grazing (that speckled flat ground). Gate in metres: their 0.005..0.020 are over a fixed
    // ~173 km far plane, ours moves.
    vec2 gradD = vec2(dx1 - dx0, dy1 - dy0);
    float dLenM = length(gradD) * uFar * uMetersPerUnit;
    float silhouetteTop = uSilhouetteGate * 4.0;
    float edge = smoothstep(uSilhouetteGate, silhouetteTop, dLenM) * clamp(dLenM / max(silhouetteTop, 1.0), 0.0, 1.0) * uDepthThreshold;

    float cover = min(min(unpackCover(cx0), unpackCover(cx1)), min(unpackCover(cy0), unpackCover(cy1))) * unpackCover(c0);
    // carried out of the ridge block for debug views 11 and 12
    float debugTurn = 0.0;
    float debugRidgeScale = 0.0;
    float debugStepMetres = 0.0;
${
    normals
        ? `    // ridges off the normal buffer (peakfinder.com's interior line): an LOD seam barely moves an
    // interpolated normal, a crest turns it tens of degrees. Horizontal components only: z follows from them.
    if (uRidgeStrength > 0.0 && cover > 0.0) {
        // tap spacing in GROUND METRES, not pixels, or the ink becomes a function of distance.
        // length(tx1) already is the ground one delta covers; widening only (>= 1).
        float stepMetres = max(length(tx1), length(ty1)) * uMetersPerUnit;
        // 64 guards against a tap crossing a silhouette (8 saturated over most of the frame);
        // uRidgeGroundSpan is the look control
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
        // a RATE per uRidgeGroundSpan: taps cannot be narrower than a texel, so an overshooting span
        // (edge-on / far) is scaled down, or the ink tracks screen position
        float spanMetres = max(stepMetres * ridgeScale, 0.001);
        turn *= uRidgeGroundSpan / spanMetres;
        debugTurn = turn;
        // linear in the turn like peakfinder.com (a smoothstep contrast-stretched the 8-bit normal
        // quantisation into contour lines), with a soft knee rather than a hard deadzone: turn^2/(turn+knee)
        // suppresses the quantisation floor without a cliff that flips regions on and off
        float ridgeRamp = turn > 0.0 ? (turn * turn) / (turn + max(uRidgeThreshold, 0.001)) : 0.0;
        // no grazing term: it suppressed ink exactly where a crest is seen in profile
        edge += ridgeRamp * uRidgeStrength;
    }`
        : `    // folds from eye positions, not depth, so an oblique slope is not a fold. uCreaseThreshold is the
    // tile-seam control: an LOD kink is a small fold, a crest a large one.
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

    // terms ADD then clamp (peakfinder.com's accumulation). Distance cutoff is a smoothstep to exactly zero
    // so far ranges stay pale, in METRES since our far plane is recomputed per frame (ink came and went on
    // pan). The sky silhouette below is deliberately outside it.
    float distMetres = d0 * uFar * uMetersPerUnit;
    edge = clamp(edge, 0.0, 1.0) * (1.0 - smoothstep(uInkDistance * 0.8, uInkDistance * 1.25, distMetres));

    // ink capped by the surface's own darkness, OFF by default: the reference caps one combined value,
    // ours sits on near-white paper, so a full cap erases every line
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

    // AR: ink and labels only (uColorTex holds the labels) over a hole for the camera preview. PREMULTIPLIED:
    // the SDK blends GL_ONE/ONE_MINUS_SRC_ALPHA and the system compositor expects it, else a grey veil.
    if (uTransparent > 0.5) {
        float inkAlpha = edge * uInkColor.a * uIntensity;
        vec4 ink = vec4(uInkColor.rgb * inkAlpha, inkAlpha);
        // labels OVER the lines
        gl_FragColor = color + ink * (1.0 - color.a);
        return;
    }

    // aerial perspective, in metres (d0 is over a per-frame far plane); only the INK fades here
    float haze = uHaze * clamp(distMetres / max(uHazeDistance, 1.0), 0.0, 1.0) * unpackCover(c0);
    // the surface is NOT hazed again: RELIEF_SURFACE_SHADER and the SDK fog already did, it would compound
    vec3 shaded = color.rgb;
    // the ink hazes too: the reference's far ranges are pale including their lines
    vec3 hazedInk = mix(uInkColor.rgb, uPaperColor.rgb, haze);
    vec3 stylized = mix(shaded, hazedInk, edge * uInkColor.a);

    // DEBUG VIEWS (peakFinderDebugView), terrain only. 8: g-buffer (green sky, red degenerate normal,
    // blue flat, grey sloped). 11: ridge turn vs threshold. 12: stepMetres/500 (r), ridgeScale/64 (g).
    // 14: uRidgeThreshold/0.3 (left) and uRidgeStrength/4 (right), to check the sliders reach the shader.
    if (uDebugView > 13.5) {
        float value = (gl_FragCoord.x * uInvScreenSize.x < 0.5) ? uRidgeThreshold / 0.3 : uRidgeStrength / 4.0;
        value = clamp(value, 0.0, 1.0);
        gl_FragColor = vec4(value, value, value, 1.0);
        return;
    }
    if (uDebugView > 10.5 && uDebugView < 11.5) {
        // BLUE under uRidgeThreshold (no ink), RED within 25% above it, GREY = actual ink contribution
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
    // bounded, or it swallows view 13
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
