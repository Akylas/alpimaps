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
    /** How far below the top of the screen that row sits, as a fraction of the screen height. */
    topOffset?: number;
    /** How many rows labels may stack into when they collide. */
    maxRows?: number;
    /** Shortest gap between two labels, px. */
    minDistance?: number;
    /** Metres; 0 for no limit. */
    maxDistance?: number;
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
    const { band = 0.25, dark = false, fontScale = 1, maxDistance = 0, maxRows = 1, minDistance = 14, minZoom = 0, pinTop = true, textAngle = 55, textSize = 16, topOffset = 0.03 } = options;
    const palette = reliefPalette(dark);
    const align = pinTop ? 'top-right' : 'bottom-left';
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
        `  text-size: ${(textSize * fontScale).toFixed(1)};`,
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
        // happened to offer first, and a 700 m hill hides a 2000 m one behind it
        '  text-placement-priority: [ele];',
        minDistance > 0 ? `  text-min-distance: ${minDistance};` : '',
        // ...and the nearer of two summits of the same height wins the slot. The culler sorts on
        // priority DESCENDING (`LabelCuller.cpp`, `priority1 > priority2`), so distance is
        // SUBTRACTED — adding it, as this did, handed the slot to whichever of the two was further
        // away. 100 m of distance trades against a metre of height.
        '  text-rank: [ele] - [view::distance]/1000;',
        `  text-orientation: ${textAngle};`,
        '  text-callout-line-anchor: bottom-left;',
        `  text-callout-align: ${align};`,
        `  text-callout-screen-anchor: ${pinTop ? topOffset : band};`,
        '  text-callout-offset: 10;',
        // pinned to the top there is no room above the row, so the extra rows go DOWN
        `  text-callout-step: ${pinTop ? -26 : 26};`,
        `  text-callout-max-rows: ${maxRows};`,
        '  text-callout-persist: 2;',
        '  text-callout-line-width: 1;',
        maxDistance > 0 ? `  text-max-distance: ${maxDistance};` : '',
        '}'
    ]
        .filter(Boolean)
        .join('\n');
}
