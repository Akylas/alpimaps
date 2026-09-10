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
    const { band = 0.25, dark = false, maxDistance = 0, maxRows = 1, minDistance = 14, minZoom = 8, pinTop = true, textAngle = 55, textSize = 16, topOffset = 0.03 } = options;
    const palette = reliefPalette(dark);
    const align = pinTop ? 'top-right' : 'bottom-left';
    return [
        `#mountain_peak['class'='peak'][zoom>=${minZoom}] {`,
        '  text-name: [name];',
        // the elevation as a second run of text: same label, same plate, smaller font
        "  text-secondary-name: [ele]+'m';",
        '  text-secondary-scale: 0.62;',
        '  text-secondary-fill: #6b7280;',
        '  text-secondary-dx: 3;',
        '  text-secondary-dy: 0;',
        `  text-size: ${textSize};`,
        `  text-fill: ${palette.ink};`,
        `  text-halo-fill: ${palette.paper};`,
        '  text-halo-radius: 1.5;',
        // the plate behind the name; it follows the palette so the names stay readable in both
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
        // ...and the nearer of two summits of the same height wins the slot. '0 - x', not '-x': in
        // CartoCSS a leading minus in front of a field is read as a literal '-'.
        '  text-rank: [ele] + [view::distance]/100;',
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
