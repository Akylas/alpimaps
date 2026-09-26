# peakfinder.com's panorama shader, as extracted

**Not committed. Working notes, so the reverse engineering does not have to be done a third time.**

## Where it came from

peakfinder.com's web viewer is a Nuxt page that loads an **Emscripten/WASM** build:

```
https://www.peakfinder.com/            -> /_nuxt/D3sYsVOU.js   (the loader)
   locateFile(...)  d = "4.8.76"       -> /wasm/peakfindermt.4.8.76.js
https://www.peakfinder.com/wasm/peakfindermt.4.8.76.wasm        (5.6 MB)
```

The GLSL is compiled into the `.wasm` as plain string literals, already run through an
optimiser (`tmpvar_N` names, bgfx `#define gl_FragColor bgfx_FragColor`). Extract with:

```sh
curl -sL https://www.peakfinder.com/wasm/peakfindermt.4.8.76.wasm -o pf.wasm
strings -n 6 pf.wasm > pf.strings
grep -n "uniform sampler2D s_fbTextureDem" pf.strings     # the panorama passes
```

Two renderers live in that binary. **MapLibre Native** (`N3map...ProgramE`, `s_elevation`,
`u_relief`, the 8192 tile extent) is their 2D map and is *not* the panorama. The panorama is the
one with `s_fbTextureDem` / `s_fbTextureDepth` / `u_fragmentParams0..3` / `u_sunDirection`.

## The panorama shading pass, decoded

A deferred pass over a G-buffer (`s_fbTextureDem`) holding, per pixel:

| channel | meaning |
| --- | --- |
| `.xy` | octahedral-encoded normal (`n.y = 1 - abs(x) - abs(z)`, so **their up is `.y`**) |
| `.z`  | an occlusion/shadow term (read as `0.5 - z`) |
| `.w`  | normalised depth; `1.0` means sky |

Five taps: centre plus four neighbours at `v_texcoord1`, a **varying** texel step (so the stroke
width can vary across the screen rather than being a constant in pixels).

```glsl
// sky is not shaded at all
if (params0.y > 0.5 && all four neighbours have w == 1.0) discard;

dX = right - left;              // vec4: normal.xyz and depth.w together
dY = down  - up;

gradNx = vec2(dX.x, dY.x);      // gradient of normal.x
gradNz = vec2(dX.z, dY.z);      // gradient of normal.z   (their two HORIZONTAL components)
gradD  = vec2(dX.w, dY.w);      // gradient of depth
dLen   = length(gradD);

// 1. INTERIOR RIDGE LINE - the length of the normal gradient
value  = length(vec2(length(gradNx), length(gradNz))) * params1.x;

// 2. SILHOUETTE - depth gradient, gated by a FIXED smoothstep and scaled by its own magnitude
value += smoothstep(0.005, 0.020, dLen) * dLen * params1.w;

// 3. SLOPE - the surface's own tilt. NOT a depth gradient.
value += length(centreNormal.xz) * params1.z;

// 4. lighting, and the ink may never exceed it
lightning = max(0.0, -sunDir.y + 0.2) * params2.y;
lightning = min(lightning + max(-0.2, -dot(sunDir, n)) * params2.w, 1.0)
          + max(0.0, 0.5 - centre.z) * (1.0 - smoothstep(0.705, 0.735, centre.w)) * params3.x;
value = min(value, min(lightning, params2.x));

// 5. DISTANCE CUTOFF - ink goes to zero past params0.x
value = min(value, 1.0 - smoothstep(params0.x - 0.05, params0.x + 0.15, centre.w));

// 6. greyscale paper/ink
color = colors.x + (1.0 - value) * colors.y;
gl_FragColor = vec4(color, color, color, 1.0);
```

## What we took (ported 2026-09-22)

geo-three's outline effect is gone from `reliefShaders.ts`. Term by term, after the port:

| theirs | ours now | state |
| --- | --- | --- |
| ridge = `length(normal gradient)` | `uRidgeStrength` term | **same**, ours takes `.xy` where theirs takes `.xz` — the same pair, different up axis |
| silhouette = depth gradient, fixed smoothstep `0.005..0.02`, ADDED | `uDepthThreshold` term, threshold relative to `d0`, one-sided | **kept ours.** A symmetric test draws every ridge twice, once on each side, which merges into a smear at the horizon |
| slope = `length(n.xz)` | `uSlopeShade * length(n.xy)` in `RELIEF_SURFACE_SHADER` | **already had it**, in the surface shader rather than the ink |
| ~~geo-three depth gradient~~ | — | **DELETED.** `uSlopeStrength`/`uSlopeMultiplier`/`uSlopeBias` and their three settings are gone |
| `value = ridge + silhouette + slope` | `edge = clamp(silhouette + interior, 0, 1)` | **taken.** Was `max`, so a crest seen against a far range drew no darker than either term alone |
| `min(value, 1 - smoothstep(p-0.05, p+0.15, depth))` | `uInkDistance`, same smoothstep | **taken**, replacing the two linear fades (`uDistanceFade`, `uCreaseFade`) |
| ink capped by the lighting | none | not ported — the post-process has no lighting to cap against |
| output greyscale, sky discarded | ink mixed over a hazed surface | ours hazes the ink too |

**The deleted slope term was the whole of the "dark far ground".** `length(n.xz)` is the sine of the
surface's tilt — a property of the GEOMETRY, identical at two kilometres and at eighty, and ~0 on
flat ground at any viewing angle. geo-three's is a depth gradient, which grows with distance because
a pixel covers more ground the further it is, so it saturated the clamp across the far half of the
view. No distance fade fixes that: the term was already at 1.0 before the fade was applied.

They never had the problem because they never measured slope from depth.

The linear fades were the second half of it. A ramp-to-a-floor leaves ink at every distance, and out
where ridges are a pixel apart, "some ink on every ridge" is a solid band whatever the floor is.
A smoothstep reaches exactly zero.

## Other things worth knowing

- They discard sky rather than shading it, so their horizon is where geometry stops, not a stroke.
- The `1.2 *` boost applied to `w` when `w >= 1.0` separates sky from far terrain in the gradients.
- `params1.z` (slope), `params1.x` (ridge) and `params1.w` (silhouette) are three independent
  strengths, which maps onto our three stores.
- The curvature constant recorded elsewhere in `terrainStore.ts` (`distance² · 6.54443e-08`,
  `1/(2R)` for R = 7640 km) belongs to their **vertex** shader, not this pass.
