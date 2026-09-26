import { reliefPalette } from '~/mapModules/terrain/reliefShaders';

/**
 * The peak finder's summit labels, as CartoCSS.
 *
 * Its own style rather than a parameter on the app's own one: only the compiled `osm.zip` is in this
 * repo, not the project it is built from, so a `peak_finder` style parameter cannot be added here.
 * A tiny inline style on the same vector source is self-contained and costs one decoder.
 *
 * Ported from the SDK demo (`demo-snippets/svelte/common/styles.ts`), whose layer name and fields are
 * OpenMapTiles' — `mountain_peak`, with `name`, `ele` and `class` — which is what this app's own
 * tiles carry too.
 *
 * Every value here is style TEXT, so a change means a new decoder. See `rebuildPeaksLayer` in
 * `features/peakFinder.ts`.
 */
export interface PeaksStyleOptions {
    dark?: boolean;
    /** The map's own font scale, so the names match the map's labels on every device. */
    fontScale?: number;
    minZoom?: number;
    textSize?: number;
    /** Rotation of the label text, degrees, off the leader line. */
    textAngle?: number;
    /** Where the label band sits, as a fraction of the screen height from the top. */
    band?: number;
    /** All labels in one row under the top edge instead of a band lower down. */
    pinTop?: boolean;
    /**
     * Drop the band entirely and sit each name just above its OWN summit, so the names follow the
     * skyline. The band is ignored when this is on; `pinTop` still picks the plate's corner.
     */
    followSkyline?: boolean;
    /** How far below the top of the screen that row sits, as a fraction of the screen height. */
    topOffset?: number;
    /** How many rows labels may stack into when they collide. */
    maxRows?: number;
    /** Shortest gap between two labels, px. */
    minDistance?: number;
    /** Passes a placed name holds its row for once it stops fitting. */
    persistPasses?: number;
    /** Metres; 0 for no limit. */
    maxDistance?: number;
    /**
     * Rank by APPARENT ALTITUDE rather than by height: at any bearing the name on the skyline wins
     * the slot, and a lower summit in front of it loses. See the `text-rank` comment.
     */
    horizonFirst?: boolean;
    /** The eye's absolute elevation, metres. Only read when `horizonFirst` is on. */
    eyeElevation?: number;
}

/**
 * Summit names as callout labels: the label is lifted to a band near the top of the screen and joined
 * back to the summit by a leader line, and a label that would collide moves one row instead of being
 * dropped ('callout' placement).
 *
 * The leader line always meets the FIRST letter of the name, which is also the point held over the
 * summit. What changes with the mode is the CORNER the row is aligned on: pinned to the top the
 * labels hang from their top right corner so the text stays under the screen edge; in a band lower
 * down they line up on the bottom left corner they are anchored by, and read up and to the right.
 */
export function peaksStyle(options: PeaksStyleOptions = {}) {
    // minZoom 0, not 8: the gate was OURS, and it is what hid the far summits. With terrain up a
    // layer's far tiles are allowed to coarsen to `cameraTileZoom - maxTileZoomCoarsening`
    // (TileLayer, 8 levels in this app), so a range a hundred kilometres out is drawn from z6/z7
    // tiles — and a zoom gate at 8 dropped every peak on them. The summit standing on the horizon
    // is exactly the one the mode exists for, so the only limit left is the data's own.
    const {
        band = 0.25,
        dark = false,
        eyeElevation = 0,
        followSkyline = false,
        fontScale = 1,
        horizonFirst = true,
        maxDistance = 0,
        maxRows = 1,
        minDistance = 14,
        minZoom = 0,
        persistPasses = 2,
        pinTop = true,
        textAngle = 55,
        textSize = 16,
        topOffset = 0.03
    } = options;
    const palette = reliefPalette(dark);
    const scaledSize = textSize * fontScale;
    const rowStep = Math.max(26, Math.round(scaledSize * 6 * Math.sin((textAngle * Math.PI) / 180) + scaledSize * 0.4));
    // ALWAYS bottom-left, which is what peakfinder.com draws: the row sits at the top of the screen
    // and every name reads UP and to the right from the point the leader line meets it. `pinTop`
    // used to also swing this to top-right, so the text hung down-left from its anchor and the
    // reference's much more readable arrangement was unreachable. `pinTop` now only decides WHERE
    // the row is (the top offset rather than the band); the corner is not a choice.
    const align = 'bottom-left';
    return [
        `#mountain_peak['class'='peak'][zoom>=${minZoom}] {`,
        '  text-name: [name];',
        // the elevation as a second run of text: same label, same plate, smaller font
        "  text-secondary-name: [ele]+'m';",
        '  text-secondary-scale: 0.62;',
        `  text-secondary-fill: ${palette.labelSecondary};`,
        '  text-secondary-dx: 3;',
        '  text-secondary-dy: 0;',
        // The map's `_fontscale` style parameter, applied by hand. The SDK already scales every label
        // by the DPI (`VectorTileLayer` hands the decoder `dpi / UNSCALED_DPI`), so this is not a
        // density term — it is the USER's size preference, which the app's own style takes as a
        // parameter and this inline one cannot, being a style of its own. Two devices set to
        // different scales therefore drew map labels at one size and summit names at another.
        `  text-size: ${scaledSize.toFixed(1)};`,
        `  text-fill: ${palette.ink};`,
        `  text-halo-fill: ${palette.paper};`,
        '  text-halo-radius: 1.5;',
        // the plate the name sits on. Pure white under the light palettes for contrast against the
        // ground, the palette's own paper under the dark ones — where white would be the brightest
        // thing on the screen. The leader line has no colour of its own: it takes `text-fill`.
        `  text-background-fill: ${dark ? palette.paper : '#ffffff'};`,
        '  text-background-opacity: 0.85;',
        '  text-background-radius: 6;',
        '  text-background-padding-x: 5;',
        '  text-background-padding-y: 2;',
        '  text-placement: callout;',
        // the higher summit claims the row: without this the winner is whichever label the tile order
        // happened to offer first, and a 700 m hill hides a 2000 m one behind it. Zero under
        // `horizonFirst`, which wants the rank below to be the WHOLE ordering - the culler adds the
        // two (`label->getPriority() + rankFunc`), so a height term here would swamp it.
        `  text-placement-priority: ${horizonFirst ? 0 : '[ele]'};`,
        minDistance > 0 ? `  text-min-distance: ${minDistance};` : '',
        // WHAT WINS A CONTESTED SLOT. Height is the wrong answer: at a given screen x the name the
        // user wants is the one on the SKYLINE, and that is not the tallest summit - it is the one
        // with the greatest apparent altitude, `atan((ele - eye) / distance)`. Ranking on the
        // tangent of that angle gets the rule exactly, and it is self-consistent: of two summits at
        // one bearing, the one with the larger angle is by definition the one above the other's line
        // of sight, so it is the one on the horizon and the one in front is hidden anyway.
        // Scaled by 1000 because the raw tangent of a far range is a few hundredths, and `+1` keeps
        // a summit at the viewpoint out of a division by zero.
        // The old rule (`[ele] - [view::distance]/1000`) is kept for `horizonFirst` off: strictly by
        // height, nearest first among equals.
        horizonFirst ? `  text-rank: 1000 * ([ele] - ${Math.round(eyeElevation)}) / ([view::distance] + 1);` : '  text-rank: [ele] - [view::distance]/1000;',
        `  text-orientation: ${textAngle};`,
        '  text-callout-line-anchor: bottom-left;',
        `  text-callout-align: ${align};`,
        // A BAND is one horizontal row of plates, so its capacity is the screen width divided by a
        // name — about seven per row, twenty-odd over three rows, whatever the terrain does. Every
        // summit in the view competes for those, which is why a name can vanish with nothing visible
        // anywhere near its own peak: the plates it lost to are all up in the band, hundreds of
        // pixels above it. Omitting the anchor (the SDK reads any negative value as 'no band', see
        // vt::Styles.h) puts each name straight above its own summit instead, so the row follows the
        // skyline and the packing becomes two-dimensional — which is what peakfinder.com draws, and
        // most of why it fits far more names on the same screen.
        followSkyline ? '' : `  text-callout-screen-anchor: ${pinTop ? topOffset : band};`,
        '  text-callout-offset: 10;',
        // How far apart the rows sit, and it has to clear the plate's own VERTICAL extent or the
        // rows overlap and stacking buys nothing. A rotated plate is a diagonal bar: a name of width
        // W at angle T spans `W·sin T` vertically, and steepening the angle to win horizontal room
        // spends it here. At 75 degrees a 100 px name is 97 px TALL, against a step that was a fixed
        // 26 - so rows two to five landed inside row one and `max-rows` was decorative. Derived from
        // the font instead: a summit name with its elevation runs about six times the text size.
        // DOWN from a row pinned at the top, up from a band lower in the screen - either way into
        // the screen rather than off its edge.
        `  text-callout-step: ${pinTop ? rowStep : -rowStep};`,
        `  text-callout-max-rows: ${maxRows};`,
        // A name that has already been placed keeps its row while the screen is crowded, rather than
        // blinking out and back. This is what a rectilinear projection needs: screen x is `tan` of
        // the angle, so a pair of summits is spread ~1.4x wider at the edge of a 67-degree view than
        // at the middle of it — the same two names fit on their way in and stop fitting as they reach
        // the centre. A held name may sit closer than `text-min-distance` while it holds, but never
        // on top of a neighbour (LabelCuller::placeCalloutLabel re-tests the grid for it).
        `  text-callout-persist: ${persistPasses};`,
        '  text-callout-line-width: 1;',
        maxDistance > 0 ? `  text-max-distance: ${maxDistance};` : '',
        '}'
    ]
        .filter(Boolean)
        .join('\n');
}
